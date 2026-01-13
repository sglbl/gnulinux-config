#!/home/sglbl/.local/share/uv/environments/base/bin/python3

import os
import sys
import subprocess
import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from tkinter import filedialog, messagebox
from tkinterdnd2 import TkinterDnD, DND_FILES

from markdown_pdf import MarkdownPdf, Section


def open_folder(path):
    if sys.platform.startswith("win"):
        os.startfile(path)
    elif sys.platform.startswith("darwin"):
        subprocess.run(["open", path])
    else:
        subprocess.run(["xdg-open", path])


def resolve_collision(path):
    directory, filename = os.path.split(path)
    base, ext = os.path.splitext(filename)

    counter = 1
    candidate = path

    while os.path.exists(candidate):
        candidate = os.path.join(directory, f"{base} ({counter}){ext}")
        counter += 1

    return candidate


def native_open_file():
    try:
        from plyer import filechooser
        paths = filechooser.open_file(
            filters=[("Markdown files", "*.md")]
        )
        return paths[0] if paths else None
    except Exception:
        return filedialog.askopenfilename(
            filetypes=[("Markdown files", "*.md")]
        )


def native_save_file(default_name):
    try:
        from plyer import filechooser
        paths = filechooser.save_file(
            filename=default_name,
            filters=[("PDF files", "*.pdf")]
        )
        return paths[0] if paths else None
    except Exception:
        return filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF files", "*.pdf")],
            initialfile=default_name
        )


class MarkdownToPdfApp(TkinterDnD.Tk):
    def __init__(self):
        super().__init__()

        self.style = ttk.Style(theme="flatly")

        self.title("Markdown → PDF")
        self.geometry("560x340")
        self.resizable(False, False)

        self.md_file = ttk.StringVar()
        self.output_path = ttk.StringVar()

        self._build_ui()

    def _build_ui(self):
        # ── Top Bar ───────────────────────────────────────────────
        topbar = ttk.Frame(self, padding=(10, 5))
        topbar.pack(fill=X)

        ttk.Label(
            topbar,
            text="Markdown → PDF",
            font=("Segoe UI", 12, "bold")
        ).pack(side=LEFT)

        ttk.Label(topbar, text="Theme").pack(side=RIGHT, padx=(5, 0))

        theme_combo = ttk.Combobox(
            topbar,
            values=self.style.theme_names(),
            state="readonly",
            width=12
        )
        theme_combo.set(self.style.theme.name)
        theme_combo.pack(side=RIGHT)

        theme_combo.bind(
            "<<ComboboxSelected>>",
            lambda e: self.style.theme_use(theme_combo.get())
        )

        # ── Main Frame ────────────────────────────────────────────
        frame = ttk.Frame(self, padding=20)
        frame.pack(fill=BOTH, expand=True)

        # ── Drop Zone ────────────────────────────────────────────
        self.drop_card = ttk.Label(
            frame,
            text="Drop Markdown file here\nor click to browse",
            anchor=CENTER,
            bootstyle="secondary",
            padding=30,
            relief="ridge"
        )
        self.drop_card.pack(fill=X, pady=(0, 15))

        self.drop_card.bind("<Button-1>", lambda e: self._browse_md())
        self.drop_card.drop_target_register(DND_FILES)
        self.drop_card.dnd_bind("<<Drop>>", self._on_drop)

        # ── Output Selector ──────────────────────────────────────
        ttk.Label(frame, text="Output PDF").pack(anchor=W)

        out_frame = ttk.Frame(frame)
        out_frame.pack(fill=X, pady=5)

        ttk.Entry(out_frame, textvariable=self.output_path).pack(
            side=LEFT, fill=X, expand=True
        )

        ttk.Button(
            out_frame,
            text="Save as…",
            command=self._choose_output,
            bootstyle=SECONDARY
        ).pack(side=RIGHT, padx=5)

        # ── Action Button ─────────────────────────────────────────
        ttk.Button(
            frame,
            text="Create PDF",
            command=self._create_pdf,
            bootstyle=SUCCESS,
            padding=10
        ).pack(fill=X, pady=20)

    # ─────────────────────────────────────────────────────────────

    def _browse_md(self):
        path = native_open_file()
        if path:
            self._set_md_file(path)

    def _on_drop(self, event):
        path = event.data.strip("{}")
        if path.lower().endswith(".md"):
            self._set_md_file(path)
        else:
            messagebox.showerror("Invalid file", "Only .md files are supported")

    def _set_md_file(self, path):
        self.md_file.set(path)
        base = os.path.splitext(os.path.basename(path))[0] + ".pdf"
        self.output_path.set(os.path.join(os.path.dirname(path), base))
        self.drop_card.config(text=os.path.basename(path))

    def _choose_output(self):
        default = self.output_path.get() or "output.pdf"
        path = native_save_file(os.path.basename(default))
        if path:
            self.output_path.set(path)

    def _create_pdf(self):
        md_path = self.md_file.get()
        output_path = self.output_path.get()

        if not md_path or not os.path.exists(md_path):
            messagebox.showerror("Error", "No valid Markdown file selected")
            return

        if not output_path:
            messagebox.showerror("Error", "Output file not selected")
            return

        if not output_path.endswith(".pdf"):
            output_path += ".pdf"

        output_path = resolve_collision(output_path)

        try:
            pdf = MarkdownPdf()
            pdf.meta["author"] = "Sglbl"

            with open(md_path, "r", encoding="utf-8") as f:
                pdf.add_section(Section(f.read(), toc=False))

            pdf.save(output_path)

            messagebox.showinfo(
                "Success",
                f"PDF created:\n{output_path}"
            )

            open_folder(os.path.dirname(output_path))

        except Exception as e:
            messagebox.showerror("Error", str(e))


if __name__ == "__main__":
    app = MarkdownToPdfApp()
    app.mainloop()
