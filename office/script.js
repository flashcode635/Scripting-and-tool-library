/**
 * @intro :
 * Used for check box a specific names in a webpage - mainly used in zoho.
 * @guide :
 * Open inspect tab (use F12)
 * open console.
 * Copy script with desired names.
 * Click enter.
 */
const wanted = new Set(`
Name One
Name Two
Name Three
`.trim().split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(Boolean));

const notSelected = new Set(wanted);
let selectedCount = 0;

// Page ke possible rows/items
const rows = document.querySelectorAll(
  'label, li, tr, [role="option"], [class*="item"], [class*="row"], [class*="card"]'
);

rows.forEach(row => {
  const text = (row.innerText || "").trim().toLowerCase();

  let matchedName = null;

  for (const name of wanted) {
    if (text === name || text.includes(name)) {
      matchedName = name;
      break;
    }
  }

  if (!matchedName) return;

  const checkbox =
    row.querySelector('input[type="checkbox"]') ||
    row.closest("label")?.querySelector('input[type="checkbox"]') ||
    document.querySelector(`label[for="${row.id}"] input[type="checkbox"]`);

  if (checkbox) {
    if (!checkbox.checked) {
      checkbox.click();

      if (!checkbox.checked) {
        const setChecked = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "checked"
        ).set;

        setChecked.call(checkbox, true);

        checkbox.dispatchEvent(new Event("input", { bubbles: true }));
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (checkbox.checked) {
      if (notSelected.delete(matchedName)) {
        selectedCount++;
      }
    }
  }
});

console.log("Selected:", selectedCount);
console.log("Not selected count:", notSelected.size);
console.log("Not selected list:", [...notSelected]);
console.table([...notSelected].map(name => ({ name })));