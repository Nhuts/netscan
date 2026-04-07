mod commands;
mod config;
mod scanner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
//        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_local_network_info,
            commands::scan_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
