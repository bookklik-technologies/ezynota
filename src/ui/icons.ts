/**
 * Icons — Lucide (ISC license, https://lucide.dev) and local table actions.
 * The SVGs are static, code-owned assets inlined at build time;
 * they are never built from user data, so injection via innerHTML is safe.
 */
import plusIcon from "lucide-static/icons/plus.svg?raw";
import gripIcon from "lucide-static/icons/grip-vertical.svg?raw";
import settingsIcon from "lucide-static/icons/settings-2.svg?raw";
import trashIcon from "lucide-static/icons/trash-2.svg?raw";
import copyIcon from "lucide-static/icons/copy.svg?raw";
import chevronUpIcon from "lucide-static/icons/chevron-up.svg?raw";
import chevronDownIcon from "lucide-static/icons/chevron-down.svg?raw";
import pilcrowIcon from "lucide-static/icons/pilcrow.svg?raw";
import headingIcon from "lucide-static/icons/heading.svg?raw";
import listIcon from "lucide-static/icons/list.svg?raw";
import quoteIcon from "lucide-static/icons/quote.svg?raw";
import codeIcon from "lucide-static/icons/code-xml.svg?raw";
import dividerIcon from "lucide-static/icons/separator-horizontal.svg?raw";
import alignLeftIcon from "lucide-static/icons/align-left.svg?raw";
import alignCenterIcon from "lucide-static/icons/align-center.svg?raw";
import alignRightIcon from "lucide-static/icons/align-right.svg?raw";
import searchIcon from "lucide-static/icons/search.svg?raw";
import fileIcon from "lucide-static/icons/file-text.svg?raw";
import filePlusIcon from "lucide-static/icons/file-plus.svg?raw";
import folderIcon from "lucide-static/icons/folder.svg?raw";
import folderOpenIcon from "lucide-static/icons/folder-open.svg?raw";
import folderPlusIcon from "lucide-static/icons/folder-plus.svg?raw";
import moonIcon from "lucide-static/icons/moon.svg?raw";
import sunIcon from "lucide-static/icons/sun.svg?raw";
import monitorIcon from "lucide-static/icons/monitor.svg?raw";
import maximizeIcon from "lucide-static/icons/maximize.svg?raw";
import minimizeIcon from "lucide-static/icons/minimize.svg?raw";
import xIcon from "lucide-static/icons/x.svg?raw";
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?raw";
import chevronLeftIcon from "lucide-static/icons/chevron-left.svg?raw";
import menuIcon from "lucide-static/icons/menu.svg?raw";
import undoIcon from "lucide-static/icons/undo-2.svg?raw";
import redoIcon from "lucide-static/icons/redo-2.svg?raw";
import downloadIcon from "lucide-static/icons/download.svg?raw";
import uploadIcon from "lucide-static/icons/upload.svg?raw";
import printerIcon from "lucide-static/icons/printer.svg?raw";
import rotateCcwIcon from "lucide-static/icons/rotate-ccw.svg?raw";
import listTreeIcon from "lucide-static/icons/list-tree.svg?raw";
import strikeIcon from "lucide-static/icons/strikethrough.svg?raw";
import paletteIcon from "lucide-static/icons/palette.svg?raw";
import highlighterIcon from "lucide-static/icons/highlighter.svg?raw";
import textColorIcon from "lucide-static/icons/baseline.svg?raw";
import backgroundColorIcon from "lucide-static/icons/paint-bucket.svg?raw";
import tableIcon from "lucide-static/icons/table.svg?raw";
import tableRowAddIcon from "./icons/table-row-add.svg?raw";
import tableColumnAddIcon from "./icons/table-column-add.svg?raw";
import tableRowDeleteIcon from "./icons/table-row-delete.svg?raw";
import tableColumnDeleteIcon from "./icons/table-column-delete.svg?raw";
import tableHeaderIcon from "lucide-static/icons/panel-top.svg?raw";
import imageIcon from "lucide-static/icons/image.svg?raw";
import infoIcon from "lucide-static/icons/info.svg?raw";
import alertIcon from "lucide-static/icons/alert-triangle.svg?raw";
import checkCircleIcon from "lucide-static/icons/check-circle.svg?raw";
import alertOctagonIcon from "lucide-static/icons/alert-octagon.svg?raw";
import panelLeftIcon from "lucide-static/icons/panel-left.svg?raw";
import replaceIcon from "lucide-static/icons/replace.svg?raw";
import linkIcon from "lucide-static/icons/link.svg?raw";
import ellipsisIcon from "lucide-static/icons/ellipsis-vertical.svg?raw";
import checkIcon from "lucide-static/icons/check.svg?raw";
import boldIcon from "lucide-static/icons/bold.svg?raw";
import italicIcon from "lucide-static/icons/italic.svg?raw";
import underlineIcon from "lucide-static/icons/underline.svg?raw";

export const ICONS = {
  plus: plusIcon,
  grip: gripIcon,
  settings: settingsIcon,
  trash: trashIcon,
  copy: copyIcon,
  up: chevronUpIcon,
  down: chevronDownIcon,
  alignLeft: alignLeftIcon,
  alignCenter: alignCenterIcon,
  alignRight: alignRightIcon,
  search: searchIcon,
  file: fileIcon,
  filePlus: filePlusIcon,
  folder: folderIcon,
  folderOpen: folderOpenIcon,
  folderPlus: folderPlusIcon,
  moon: moonIcon,
  sun: sunIcon,
  monitor: monitorIcon,
  maximize: maximizeIcon,
  minimize: minimizeIcon,
  x: xIcon,
  chevronRight: chevronRightIcon,
  chevronLeft: chevronLeftIcon,
  menu: menuIcon,
  undo: undoIcon,
  redo: redoIcon,
  download: downloadIcon,
  upload: uploadIcon,
  printer: printerIcon,
  restore: rotateCcwIcon,
  outline: listTreeIcon,
  strikethrough: strikeIcon,
  palette: paletteIcon,
  highlighter: highlighterIcon,
  code: codeIcon,
  textColor: textColorIcon,
  backgroundColor: backgroundColorIcon,
  table: tableIcon,
  tableRowAdd: tableRowAddIcon,
  tableColumnAdd: tableColumnAddIcon,
  tableRowDelete: tableRowDeleteIcon,
  tableColumnDelete: tableColumnDeleteIcon,
  tableHeader: tableHeaderIcon,
  image: imageIcon,
  info: infoIcon,
  alert: alertIcon,
  success: checkCircleIcon,
  danger: alertOctagonIcon,
  caretRight: chevronRightIcon,
  caretDown: chevronDownIcon,
  panelLeft: panelLeftIcon,
  replace: replaceIcon,
  link: linkIcon,
  ellipsis: ellipsisIcon,
  check: checkIcon,
  bold: boldIcon,
  italic: italicIcon,
  underline: underlineIcon
};

/** Tool palette icons (slash menu + block settings "convert to" list). */
export const TOOL_ICONS = {
  paragraph: pilcrowIcon,
  heading: headingIcon,
  list: listIcon,
  quote: quoteIcon,
  code: codeIcon,
  delimiter: dividerIcon,
  table: tableIcon,
  image: imageIcon,
  callout: infoIcon,
  toggle: chevronRightIcon
};

/** Is the given toolbox icon an inline SVG string (lucide) vs. a text glyph? */
export function isSvgIcon(icon: string | undefined): boolean {
  // Lucide's raw assets include a leading license comment. Keep it in the
  // rendered asset, but skip comments when detecting SVG rather than text.
  return typeof icon === "string" && /^(?:\s|<!--[\s\S]*?-->)*<svg(?:\s|>)/i.test(icon);
}

/** Render a code-owned icon string into an element (never user data). */
export function renderIcon(icon: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "ez-menu-icon";
  span.innerHTML = icon;
  span.setAttribute("aria-hidden", "true");
  for (const svg of Array.from(span.querySelectorAll("svg"))) {
    svg.setAttribute("stroke-width", "1.8");
  }
  return span;
}
