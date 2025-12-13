use hunspell_rs::Hunspell;
use std::sync::Mutex;
use tauri::{Manager, State};

// Wrapper to make Hunspell Send (unsafe but necessary for Tauri state if we lock it properly)
struct SafeHunspell(Hunspell);

unsafe impl Send for SafeHunspell {}
unsafe impl Sync for SafeHunspell {}

struct SpellCheckState {
    hunspell: Mutex<Option<SafeHunspell>>,
    custom_words: Mutex<Vec<String>>,
}

struct StartupFile {
    path: Mutex<Option<String>>,
    content: Mutex<Option<String>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn init_spell_check(
    state: State<'_, SpellCheckState>,
    aff_path: String,
    dic_path: String,
    custom_words: Vec<String>,
) -> Result<(), String> {
    println!("Init Spell Check: aff={}, dic={}", aff_path, dic_path);
    // Try to find the dictionary files.
    // In dev mode, they might be in ../public/dictionaries relative to the crate root,
    // or relative to the executable.

    let try_paths = vec![
        (aff_path.clone(), dic_path.clone()),
        // Fallback for dev mode (relative to CWD which is often src-tauri or project root)
        (
            format!("../public/dictionaries/en_US.aff"),
            format!("../public/dictionaries/en_US.dic"),
        ),
        (
            format!("public/dictionaries/en_US.aff"),
            format!("public/dictionaries/en_US.dic"),
        ),
        // Fallback relative to executable in target/debug
        (
            format!("../../../public/dictionaries/en_US.aff"),
            format!("../../../public/dictionaries/en_US.dic"),
        ),
        // Fallback for src-tauri/dictionaries
        (
            format!("dictionaries/en_US.aff"),
            format!("dictionaries/en_US.dic"),
        ),
    ];

    let mut hunspell = None;

    for (aff, dic) in try_paths {
        println!("Trying dictionary paths: aff={}, dic={}", aff, dic);
        // Check if files exist first to avoid Hunspell panic/failure
        if std::path::Path::new(&aff).exists() && std::path::Path::new(&dic).exists() {
            hunspell = Some(Hunspell::new(&aff, &dic));
            println!("Successfully loaded dictionaries from: {}", aff);
            break;
        }
    }

    let hunspell = hunspell.ok_or("Failed to find dictionary files in any expected location")?;

    let mut state_hunspell = state.hunspell.lock().map_err(|_| "Failed to lock mutex")?;
    *state_hunspell = Some(SafeHunspell(hunspell));

    let mut state_custom = state
        .custom_words
        .lock()
        .map_err(|_| "Failed to lock mutex")?;
    *state_custom = custom_words;
    println!(
        "Spell Check Initialized with {} custom words",
        state_custom.len()
    );

    Ok(())
}

#[tauri::command]
fn add_custom_word(state: State<'_, SpellCheckState>, word: String) -> Result<(), String> {
    let mut custom = state
        .custom_words
        .lock()
        .map_err(|_| "Failed to lock mutex")?;
    custom.push(word);
    Ok(())
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

#[derive(serde::Serialize)]
struct ErrorRange {
    word: String,
    index: usize,
    length: usize,
}

#[tauri::command]
fn check_text(state: State<'_, SpellCheckState>, text: String) -> Result<Vec<ErrorRange>, String> {
    let hunspell_guard = state.hunspell.lock().map_err(|_| "Failed to lock mutex")?;
    let safe_hunspell = hunspell_guard
        .as_ref()
        .ok_or("Spell checker not initialized")?;
    let hunspell = &safe_hunspell.0;

    let custom_guard = state
        .custom_words
        .lock()
        .map_err(|_| "Failed to lock mutex")?;

    let mut errors = Vec::new();

    // Simple regex for word splitting - matches frontend behavior
    let re = regex::Regex::new(r"\b\w+(?:['’]\w+)?\b").map_err(|e| e.to_string())?;

    let mut last_byte_pos = 0;
    let mut last_utf16_pos = 0;

    for cap in re.captures_iter(&text) {
        if let Some(m) = cap.get(0) {
            let word = m.as_str();
            let start_byte = m.start();

            // Calculate UTF-16 offset
            // We advance from last_byte_pos to start_byte
            let prefix = &text[last_byte_pos..start_byte];
            let prefix_utf16_len = prefix.encode_utf16().count();
            let start_utf16 = last_utf16_pos + prefix_utf16_len;

            // Update trackers
            last_byte_pos = start_byte;
            last_utf16_pos = start_utf16;

            if custom_guard.contains(&word.to_string()) {
                continue;
            }

            let normalized = word.replace("’", "'");

            if !hunspell.check(word) && !hunspell.check(&normalized) {
                let word_utf16_len = word.encode_utf16().count();
                errors.push(ErrorRange {
                    word: word.to_string(),
                    index: start_utf16,
                    length: word_utf16_len,
                });
            }
        }
    }
    // println!("Found {} errors in text length {}", errors.len(), text.len());

    Ok(errors)
}

#[tauri::command]
fn get_suggestions(state: State<'_, SpellCheckState>, word: String) -> Result<Vec<String>, String> {
    let hunspell_guard = state.hunspell.lock().map_err(|_| "Failed to lock mutex")?;
    let safe_hunspell = hunspell_guard
        .as_ref()
        .ok_or("Spell checker not initialized")?;
    let hunspell = &safe_hunspell.0;

    let suggestions = hunspell.suggest(&word);
    println!("Suggestions for '{}': {:?}", word, suggestions);
    Ok(suggestions)
}

#[tauri::command]
fn get_startup_file(state: State<'_, StartupFile>) -> Result<Option<(String, String)>, String> {
    let path_guard = state.path.lock().map_err(|_| "Failed to lock path mutex")?;
    let content_guard = state
        .content
        .lock()
        .map_err(|_| "Failed to lock content mutex")?;

    if let (Some(p), Some(c)) = (path_guard.as_ref(), content_guard.as_ref()) {
        Ok(Some((p.clone(), c.clone())))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SpellCheckState {
            hunspell: Mutex::new(None),
            custom_words: Mutex::new(Vec::new()),
        })
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            let mut start_path = None;
            let mut start_content = None;

            // Simple check: if there's an argument that isn't a flag and looks like a file
            if args.len() > 1 {
                // Skip the first arg (executable name)
                for arg in &args[1..] {
                    if !arg.starts_with("-") {
                        if let Ok(content) = std::fs::read_to_string(arg) {
                            start_path = Some(arg.clone());
                            start_content = Some(content);
                            break;
                        }
                    }
                }
            }

            app.manage(StartupFile {
                path: Mutex::new(start_path),
                content: Mutex::new(start_content),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            read_file,
            write_file,
            init_spell_check,
            check_text,
            get_suggestions,
            check_text,
            get_suggestions,
            add_custom_word,
            get_startup_file,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
