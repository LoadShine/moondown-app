use std::sync::Mutex;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_fs::FsExt;

struct OpenedUrls(Mutex<Vec<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(OpenedUrls(Mutex::new(initial_opened_urls())))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![allow_fs_path, opened_urls])
        .setup(|app| {
            build_menu(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Moondown")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
            if let tauri::RunEvent::Opened { urls } = event {
                let opened_urls = urls
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>();
                if let Ok(mut state) = app_handle.state::<OpenedUrls>().0.lock() {
                    state.extend(opened_urls.clone());
                }
                let _ = app_handle.emit("moondown-opened", opened_urls);
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}

fn initial_opened_urls() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| is_markdown_path_or_url(arg))
        .collect()
}

fn is_markdown_path_or_url(value: &str) -> bool {
    let lowercase = value.to_ascii_lowercase();
    ["md", "markdown", "mdown", "mkd"]
        .iter()
        .any(|extension| lowercase.ends_with(&format!(".{extension}")))
}

#[tauri::command]
fn opened_urls(app: AppHandle) -> Result<Vec<String>, String> {
    let opened_urls = app.state::<OpenedUrls>();
    let mut state = opened_urls
        .0
        .lock()
        .map_err(|error| error.to_string())?;
    Ok(state.drain(..).collect())
}

#[tauri::command]
fn allow_fs_path(app: AppHandle, path: String, recursive: bool) -> Result<(), String> {
    let scope = app.fs_scope();
    let path_buf = std::path::PathBuf::from(&path);
    match std::fs::metadata(&path_buf) {
        Ok(metadata) if metadata.is_dir() => scope.allow_directory(&path_buf, recursive),
        _ => scope.allow_file(&path_buf),
    }
    .map_err(|error| error.to_string())
}

fn build_menu(app: &mut tauri::App) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "Moondown")
        .item(&menu_item(app, "settings", "Settings...", "CmdOrCtrl+,")?)
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&menu_item(app, "new-document", "New", "CmdOrCtrl+N")?)
        .item(&menu_item(app, "close-window", "Close Window", "CmdOrCtrl+W")?)
        .item(&menu_item(app, "open-file", "Open File...", "CmdOrCtrl+O")?)
        .item(&menu_item(app, "open-folder", "Open Folder...", "CmdOrCtrl+Shift+O")?)
        .separator()
        .item(&menu_item(app, "save", "Save", "CmdOrCtrl+S")?)
        .item(&menu_item(app, "save-as", "Save As...", "CmdOrCtrl+Shift+S")?)
        .separator()
        .item(&menu_item(app, "export-markdown", "Export Markdown...", "CmdOrCtrl+Alt+M")?)
        .item(&menu_item(app, "export-txt", "Export TXT...", "CmdOrCtrl+Alt+T")?)
        .item(&menu_item(app, "export-html", "Export HTML...", "CmdOrCtrl+Alt+H")?)
        .item(&menu_item(app, "export-docx", "Export Word...", "CmdOrCtrl+Alt+W")?)
        .item(&menu_item(app, "export-jpg", "Export JPG...", "CmdOrCtrl+Alt+J")?)
        .item(&menu_item(app, "export-epub", "Export EPUB...", "CmdOrCtrl+Alt+E")?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .item(&menu_item(app, "find", "Find", "CmdOrCtrl+F")?)
        .item(&menu_item(app, "replace", "Replace", "CmdOrCtrl+R")?)
        .separator()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&menu_item(app, "toggle-tree", "Toggle Folder Tree", "CmdOrCtrl+\\")?)
        .item(&menu_item(app, "toggle-syntax", "Toggle Markdown Markers", "CmdOrCtrl+Shift+M")?)
        .separator()
        .item(&menu_item(app, "theme-system", "Theme: System", "CmdOrCtrl+Alt+0")?)
        .item(&menu_item(app, "theme-light", "Theme: Light", "CmdOrCtrl+Alt+1")?)
        .item(&menu_item(app, "theme-dark", "Theme: Dark", "CmdOrCtrl+Alt+2")?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu])
        .build()?;
    app.set_menu(menu)?;

    app.on_menu_event(|app_handle, event| {
        let id = event.id().as_ref();
        if is_frontend_menu_event(id) {
            let _ = app_handle.emit("moondown-menu", id);
        }
    });

    Ok(())
}

fn menu_item(
    app: &tauri::App,
    id: &'static str,
    label: &'static str,
    accelerator: &'static str,
) -> tauri::Result<tauri::menu::MenuItem<tauri::Wry>> {
    MenuItemBuilder::with_id(id, label)
        .accelerator(accelerator)
        .build(app)
}

fn is_frontend_menu_event(id: &str) -> bool {
    matches!(
        id,
        "settings"
            | "new-document"
            | "close-window"
            | "open-file"
            | "open-folder"
            | "save"
            | "save-as"
            | "find"
            | "replace"
            | "toggle-tree"
            | "toggle-syntax"
            | "theme-system"
            | "theme-light"
            | "theme-dark"
            | "export-markdown"
            | "export-txt"
            | "export-html"
            | "export-docx"
            | "export-jpg"
            | "export-epub"
    )
}
