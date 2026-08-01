/* Seventh editor iteration: keep compact toolbar menus unobtrusive. */

const toolbarMenusV7 = [...document.querySelectorAll(".toolbar-menu")];

function closeToolbarMenusV7(exception = null) {
  toolbarMenusV7.forEach((menu) => {
    if (menu !== exception) menu.open = false;
  });
}

toolbarMenusV7.forEach((menu) => {
  menu.addEventListener("toggle", () => {
    if (menu.open) closeToolbarMenusV7(menu);
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("button")) menu.open = false;
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".toolbar-menu")) closeToolbarMenusV7();
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => closeToolbarMenusV7());
});
