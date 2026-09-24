#!/usr/bin/env python3
"""
Disk Detective - a simple GUI tool that groups installed software and large
untracked folders on your system so you can see what's taking up space and
decide what to remove.

It looks in four places:
  1. APT packages (dpkg)              -> e.g. firefox, vlc
  2. Snap packages                    -> e.g. spotify
  3. Flatpak apps                     -> e.g. org.gimp.GIMP
  4. "Loose" folders not owned by any package manager: every top-level
     folder in your home directory, plus /opt and /usr/local system-wide.
     Grab-bag folders (.cache, .local/share, .var/app, ~/snap) are expanded
     one level deeper so you see which app inside them is using the space
     -> e.g. Ollama, which installs its binary via apt/dpkg but drops its
        ~40 model/data files under ~/.ollama, shows up as one "ollama" row.

Flow: scan (with a loader) -> check the items you don't need -> click
Delete Selected -> confirm once -> commands run right away.

Run with:  python3 disk_detective.py
Requires:  python3-tk  (sudo apt install python3-tk)
"""

import os
import shutil
import subprocess
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

HOME = os.path.expanduser("~")

# ---- Monochrome theme (no blue/purple) ----
BG = "#000000"
PANEL = "#1a1a1a"
PANEL2 = "#141414"
BORDER = "#333333"
TEXT = "#f2f2f2"
SUBTEXT = "#8a8a8a"
ROW_ALT = "#0c0c0c"
CHECKED_BG = "#2b2b2b"
WHITE = "#ffffff"
DANGER = "#e5484d"
DANGER_HOVER = "#c8383d"

CHECK_ON = "✅"
CHECK_OFF = "⬜"

# "Grab-bag" folders that hold many unrelated apps' data inside them - these
# get expanded one level deeper so e.g. ".cache" doesn't show as one blob,
# but as "spotify (.cache)", "pip (.cache)", etc.
EXPAND_ONE_LEVEL = {".cache", os.path.join(".local", "share"), os.path.join(".var", "app"), "snap"}

# System-wide (non-home) locations to scan, one level deep, for software
# that isn't tracked by apt/snap/flatpak (manual installs, tarballs, etc).
SYSTEM_TARGETS = ["/opt", "/usr/local"]


def run(cmd):
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        return out.stdout.strip()
    except Exception:
        return ""


def du_bytes(path):
    if not os.path.exists(path):
        return 0
    out = run(f"du -sb '{path}' 2>/dev/null | cut -f1")
    try:
        return int(out.strip())
    except Exception:
        return 0


def human(n):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} {unit}"
        n /= 1024
    return f"{n:.1f} PB"


class Item:
    def __init__(self, name, kind, size_bytes, identifier):
        self.name = name
        self.kind = kind  # apt / snap / flatpak / folder
        self.size_bytes = size_bytes
        self.identifier = identifier

    def removal_command(self):
        if self.kind == "apt":
            return f"sudo apt remove --purge -y {self.identifier}"
        if self.kind == "snap":
            return f"sudo snap remove {self.identifier}"
        if self.kind == "flatpak":
            return f"flatpak uninstall -y {self.identifier}"
        if self.kind == "folder":
            return f"rm -rf '{self.identifier}'"
        return ""


def scan_apt():
    items = []
    out = run("dpkg-query -W -f='${Package}\\t${Installed-Size}\\n' 2>/dev/null")
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        name, size_kb = parts
        try:
            size_bytes = int(size_kb) * 1024
        except ValueError:
            continue
        items.append(Item(name, "apt", size_bytes, name))
    return items


def scan_snap():
    items = []
    if shutil.which("snap") is None:
        return items
    out = run("snap list 2>/dev/null | tail -n +2 | awk '{print $1}'")
    for name in out.splitlines():
        name = name.strip()
        if not name:
            continue
        items.append(Item(name, "snap", du_bytes(f"/snap/{name}"), name))
    return items


def scan_flatpak():
    items = []
    if shutil.which("flatpak") is None:
        return items
    out = run("flatpak list --app --columns=application,name 2>/dev/null")
    for line in out.splitlines():
        parts = line.split("\t")
        app_id = parts[0].strip()
        label = parts[1].strip() if len(parts) > 1 else app_id
        if not app_id:
            continue
        data_path = os.path.join(HOME, ".var", "app", app_id)
        items.append(Item(label, "flatpak", du_bytes(data_path), app_id))
    return items


def scan_loose():
    items = []
    try:
        home_entries = os.listdir(HOME)
    except PermissionError:
        home_entries = []
    for entry in home_entries:
        full = os.path.join(HOME, entry)
        if not os.path.isdir(full) or os.path.islink(full):
            continue
        if entry in EXPAND_ONE_LEVEL:
            try:
                sub_entries = os.listdir(full)
            except PermissionError:
                continue
            for sub in sub_entries:
                sub_full = os.path.join(full, sub)
                size = du_bytes(sub_full)
                if size <= 0:
                    continue
                items.append(Item(f"{sub}  ({entry})", "folder", size, sub_full))
        else:
            size = du_bytes(full)
            if size > 0:
                items.append(Item(entry, "folder", size, full))

    for base in SYSTEM_TARGETS:
        if not os.path.isdir(base):
            continue
        try:
            entries = os.listdir(base)
        except PermissionError:
            continue
        for entry in entries:
            full = os.path.join(base, entry)
            if not os.path.isdir(full):
                continue
            size = du_bytes(full)
            if size <= 0:
                continue
            items.append(Item(f"{entry}  ({os.path.basename(base)})", "folder", size, full))

    return items


class App:
    def __init__(self, root):
        self.root = root
        root.title("Disk Detective")
        root.geometry("980x660")
        root.configure(bg=BG)
        root.minsize(760, 460)

        self._setup_style()

        # Header
        header = tk.Frame(root, bg=BG)
        header.pack(fill="x", padx=18, pady=(16, 6))
        tk.Label(header, text="Disk Detective", bg=BG, fg=WHITE,
                  font=("Sans", 17, "bold")).pack(side="left")
        tk.Label(header, text="   installed apps + loose folders, grouped",
                  bg=BG, fg=SUBTEXT, font=("Sans", 10)).pack(side="left")
        self.rescan_btn = tk.Button(header, text="Rescan", command=self.start_scan,
                                     bg=PANEL, fg=TEXT, activebackground=BORDER,
                                     activeforeground=WHITE, relief="flat", bd=0,
                                     padx=14, pady=6, font=("Sans", 10))
        self.rescan_btn.pack(side="right")

        # Loader row (hidden until scanning)
        self.loader_frame = tk.Frame(root, bg=BG)
        self.loader_label = tk.Label(self.loader_frame, text="Scanning...", bg=BG, fg=WHITE,
                                      font=("Sans", 10, "bold"))
        self.loader_label.pack(side="left", padx=(18, 10), pady=(0, 6))
        self.progress = ttk.Progressbar(self.loader_frame, mode="indeterminate",
                                         style="Mono.Horizontal.TProgressbar", length=200)
        self.progress.pack(side="left", pady=(0, 6))

        # Table
        self.table_frame = tk.Frame(root, bg=BG)
        self.table_frame.pack(fill="both", expand=True, padx=18, pady=6)

        cols = ("check", "name", "kind", "size")
        self.tree = ttk.Treeview(self.table_frame, columns=cols, show="headings",
                                  selectmode="none", style="Mono.Treeview")
        self.tree.heading("check", text="")
        self.tree.heading("name", text="NAME", command=lambda: self.sort_by("name"))
        self.tree.heading("kind", text="TYPE", command=lambda: self.sort_by("kind"))
        self.tree.heading("size", text="SIZE", command=lambda: self.sort_by("size"))
        self.tree.column("check", width=64, anchor="center", stretch=False)
        self.tree.column("name", width=460, anchor="w")
        self.tree.column("kind", width=100, anchor="center", stretch=False)
        self.tree.column("size", width=110, anchor="e", stretch=False)
        self.tree.pack(side="left", fill="both", expand=True)
        self.tree.bind("<Button-1>", self.on_click)

        vsb = ttk.Scrollbar(self.table_frame, orient="vertical", command=self.tree.yview)
        vsb.pack(side="right", fill="y")
        self.tree.configure(yscroll=vsb.set)

        self.tree.tag_configure("odd", background=BG, foreground=TEXT)
        self.tree.tag_configure("even", background=ROW_ALT, foreground=TEXT)
        self.tree.tag_configure("checked", background=CHECKED_BG, foreground=WHITE)

        # Bottom bar
        bottom = tk.Frame(root, bg=BG)
        bottom.pack(fill="x", padx=18, pady=(8, 4))
        self.total_label = tk.Label(bottom, text="Selected: 0 items, 0 B",
                                     bg=BG, fg=WHITE, font=("Sans", 11, "bold"))
        self.total_label.pack(side="left")

        self.delete_btn = tk.Button(bottom, text="Delete Selected", command=self.confirm_and_delete,
                                     bg=DANGER, fg=WHITE, activebackground=DANGER_HOVER,
                                     activeforeground=WHITE, relief="flat", bd=0,
                                     padx=16, pady=8, font=("Sans", 10, "bold"),
                                     state="disabled")
        self.delete_btn.pack(side="right")

        self.items = {}
        self.checked = set()

        self.status = tk.Label(root, text="", bg=PANEL2, fg=SUBTEXT,
                                anchor="w", padx=12, pady=5, font=("Sans", 9))
        self.status.pack(fill="x", side="bottom")

        self.start_scan()

    def _setup_style(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Mono.Treeview",
                         background=BG, fieldbackground=BG, foreground=TEXT,
                         rowheight=34, borderwidth=0, font=("Sans", 11))
        style.configure("Mono.Treeview.Heading",
                         background=PANEL, foreground=SUBTEXT, relief="flat",
                         font=("Sans", 9, "bold"))
        style.map("Mono.Treeview.Heading", background=[("active", BORDER)])
        style.map("Mono.Treeview", background=[("selected", CHECKED_BG)],
                  foreground=[("selected", WHITE)])
        style.configure("Mono.Horizontal.TProgressbar",
                         background=WHITE, troughcolor=PANEL, borderwidth=0, thickness=6)

    def start_scan(self):
        self.rescan_btn.config(state="disabled")
        self.loader_frame.pack(fill="x", before=self.table_frame)
        self.progress.start(12)
        self.status.config(text="")
        for row in self.tree.get_children():
            self.tree.delete(row)
        self.items.clear()
        self.checked.clear()
        self.update_total()
        threading.Thread(target=self.do_scan, daemon=True).start()

    def do_scan(self):
        all_items = scan_apt() + scan_snap() + scan_flatpak() + scan_loose()
        all_items.sort(key=lambda i: i.size_bytes, reverse=True)
        self.root.after(0, self.populate, all_items)

    def populate(self, all_items):
        for idx, item in enumerate(all_items):
            iid = f"i{idx}"
            self.items[iid] = item
            stripe = "even" if idx % 2 == 0 else "odd"
            self.tree.insert("", "end", iid=iid,
                              values=(CHECK_OFF, item.name, item.kind, human(item.size_bytes)),
                              tags=(stripe,))
        total_size = sum(i.size_bytes for i in all_items)
        self.status.config(text=f"{len(all_items)} items found  ·  {human(total_size)} total")
        self.progress.stop()
        self.loader_frame.pack_forget()
        self.rescan_btn.config(state="normal")

    def on_click(self, event):
        row = self.tree.identify_row(event.y)
        col = self.tree.identify_column(event.x)
        if not row or col != "#1":
            return
        item = self.items.get(row)
        if not item:
            return
        idx = list(self.items.keys()).index(row)
        stripe = "even" if idx % 2 == 0 else "odd"
        if row in self.checked:
            self.checked.remove(row)
            self.tree.set(row, "check", CHECK_OFF)
            self.tree.item(row, tags=(stripe,))
        else:
            self.checked.add(row)
            self.tree.set(row, "check", CHECK_ON)
            self.tree.item(row, tags=("checked",))
        self.update_total()

    def update_total(self):
        total = sum(self.items[i].size_bytes for i in self.checked)
        self.total_label.config(text=f"Selected: {len(self.checked)} items, {human(total)}")
        self.delete_btn.config(state="normal" if self.checked else "disabled")

    def sort_by(self, key):
        rows = list(self.tree.get_children())
        if key == "size":
            rows.sort(key=lambda r: self.items[r].size_bytes, reverse=True)
        elif key == "name":
            rows.sort(key=lambda r: self.items[r].name.lower())
        else:
            rows.sort(key=lambda r: self.items[r].kind)
        for pos, r in enumerate(rows):
            self.tree.move(r, "", pos)
            if r not in self.checked:
                stripe = "even" if pos % 2 == 0 else "odd"
                self.tree.item(r, tags=(stripe,))

    def _center(self, win, w, h):
        self.root.update_idletasks()
        rx, ry = self.root.winfo_x(), self.root.winfo_y()
        rw, rh = self.root.winfo_width(), self.root.winfo_height()
        x = rx + max(0, (rw - w) // 2)
        y = ry + max(0, (rh - h) // 2)
        win.geometry(f"{w}x{h}+{x}+{y}")

    def confirm_and_delete(self):
        if not self.checked:
            return
        cmds = [self.items[i].removal_command() for i in self.checked]
        total = sum(self.items[i].size_bytes for i in self.checked)

        win = tk.Toplevel(self.root)
        win.title("Confirm delete")
        win.configure(bg=BG)
        win.transient(self.root)
        win.resizable(True, True)
        win.minsize(560, 320)
        self._center(win, 680, 460)

        tk.Label(win, text=f"Delete {len(self.checked)} item(s), freeing {human(total)}?",
                 bg=BG, fg=WHITE, font=("Sans", 13, "bold")).pack(anchor="w", padx=16, pady=(16, 2))
        tk.Label(win, text="These commands will run as soon as you click Delete Now.",
                 bg=BG, fg=SUBTEXT, font=("Sans", 9)).pack(anchor="w", padx=16, pady=(0, 10))

        # Pack the button bar FIRST (anchored to the bottom) so it always has
        # room and can never get pushed out of view by a long command list.
        btns = tk.Frame(win, bg=BG)
        btns.pack(side="bottom", fill="x", padx=16, pady=14)

        def do_delete():
            win.destroy()
            log = tk.Toplevel(self.root)
            log.title("Deleting...")
            log.configure(bg=BG)
            log.transient(self.root)
            self._center(log, 680, 420)
            log_box = scrolledtext.ScrolledText(log, wrap="word", bg=PANEL, fg=TEXT,
                                                 font=("Consolas", 10), bd=0)
            log_box.pack(fill="both", expand=True, padx=12, pady=12)

            def worker():
                for c in cmds:
                    log_box.insert("end", f"$ {c}\n")
                    log_box.see("end")
                    result = subprocess.run(c, shell=True, capture_output=True, text=True)
                    log_box.insert("end", (result.stdout + result.stderr).strip() + "\n\n")
                    log_box.see("end")
                log_box.insert("end", "Done.\n")
                self.root.after(0, self.start_scan)

            threading.Thread(target=worker, daemon=True).start()

        tk.Button(btns, text="Cancel", command=win.destroy,
                  bg=PANEL, fg=TEXT, activebackground=BORDER, activeforeground=WHITE,
                  relief="flat", bd=0, padx=14, pady=9, font=("Sans", 10)).pack(side="left")
        tk.Button(btns, text="Delete Now", command=do_delete,
                  bg=DANGER, fg=WHITE, activebackground=DANGER_HOVER, activeforeground=WHITE,
                  relief="flat", bd=0, padx=18, pady=9, font=("Sans", 11, "bold")).pack(side="right")

        box = scrolledtext.ScrolledText(win, wrap="word", bg=PANEL, fg=TEXT,
                                         insertbackground=TEXT, relief="flat",
                                         font=("Consolas", 10), bd=0)
        box.pack(fill="both", expand=True, padx=16, pady=4)
        box.insert("1.0", "\n".join(cmds))
        box.config(state="disabled")


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()