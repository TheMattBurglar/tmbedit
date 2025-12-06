# tmbedit

**tmbedit** is a minimal, distraction-free Markdown editor designed for creative writers who want to focus on their words. Built with performance and privacy in mind, it combines the speed of a native application with the flexibility of modern web technologies.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

*   **Hybrid Editing Modes**: Switch seamlessly between a rich **WYSIWYG** (What You See Is What You Get) interface and a raw **Source Mode** for full control over your Markdown.
*   **Distraction-Free UI**: A clean, minimal interface that gets out of your way.
*   **Native Performance**: Built with **Rust** and **Tauri**, ensuring a lightweight footprint and blazing fast startup times.
*   **Offline & Local**: Your files stay on your machine. No cloud sync required.
*   **Spell Check**: Integrated spell checking powered by **Hunspell** (the same engine used by LibreOffice and Firefox).
*   **Customizable**: Adjust font size and family (Sans, Serif, Mono) to suit your writing style.

### Installation
Since this project does not currently distribute pre-built binaries, the best way to install it is to build it from source.

See the **Development** section below for instructions on how to build and run the application locally. Once built, you can find the installer packages in `src-tauri/target/release/bundle/`.

## Development

If you want to build `tmbedit` from source or contribute to its development, follow these steps.

### Prerequisites

*   **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
*   **Node.js**: [Install Node.js](https://nodejs.org/) (v16 or newer recommended)
*   **System Dependencies**: You may need development libraries for Tauri (e.g., `webkit2gtk`, `libappindicator`). See the [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) guide.

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/TheMattBurglar/tmbedit.git
    cd tmbedit
    ```

2.  Install frontend dependencies:
    ```bash
    npm install
    ```

### Running Locally

Start the development server with hot-reloading:

```bash
npm run tauri dev
```

### Building for Production

Compile the application into a standalone binary/installer:

```bash
npm run tauri build
```

The output files will be located in `src-tauri/target/release/bundle/`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

*   Built with [Tauri](https://tauri.app/)
*   Editor powered by [Tiptap](https://tiptap.dev/)
*   Spell checking via [hunspell-rs](https://crates.io/crates/hunspell-rs)
