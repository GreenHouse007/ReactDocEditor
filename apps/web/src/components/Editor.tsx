import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { useEffect } from "react";

interface EditorProps {
  content: any;
  onChange: (content: any) => void;
  placeholder?: string;
}

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return {
      types: ["textStyle"],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});

const FONT_SIZES = ["12pt", "14pt", "16pt", "18pt", "24pt", "32pt"];

export function Editor({
  content,
  onChange,
  placeholder = "Start writing...",
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontSize,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none focus:outline-none min-h-[650px] px-8 py-6 text-gray-100",
      },
    },
  });

  useEffect(() => {
    if (
      editor &&
      content &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(content)
    ) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const activeFontSize = editor.getAttributes("textStyle").fontSize ?? "default";
  const activeColor = editor.getAttributes("textStyle").color ?? "#ffffff";

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 p-3 text-sm">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-3 py-1 font-semibold transition-colors ${
            editor.isActive("bold")
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-3 py-1 italic transition-colors ${
            editor.isActive("italic")
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded px-3 py-1 underline transition-colors ${
            editor.isActive("underline")
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          Underline
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`rounded px-3 py-1 transition-colors ${
            editor.isActive("heading", { level: 1 })
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded px-3 py-1 transition-colors ${
            editor.isActive("heading", { level: 2 })
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-3 py-1 transition-colors ${
            editor.isActive("bulletList")
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          Bullet List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded px-3 py-1 transition-colors ${
            editor.isActive("orderedList")
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          type="button"
        >
          Numbered List
        </button>
        <select
          value={FONT_SIZES.includes(activeFontSize) ? activeFontSize : "default"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "default") {
              editor
                .chain()
                .focus()
                .setMark("textStyle", { fontSize: null })
                .removeEmptyTextStyle()
                .run();
            } else {
              editor
                .chain()
                .focus()
                .setMark("textStyle", { fontSize: value })
                .run();
            }
          }}
          className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="default">Font size</option>
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded bg-gray-700 px-3 py-1 text-gray-200">
          <span>Color</span>
          <input
            type="color"
            value={activeColor}
            onChange={(event) => {
              editor.chain().focus().setColor(event.target.value).run();
            }}
            className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="rounded bg-gray-700 px-3 py-1 text-gray-200 transition-colors hover:bg-gray-600"
          type="button"
        >
          Horizontal Line
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
