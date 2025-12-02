import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import './Editor.css' // We will add simple styles here

const Editor = () => {
  const editor = useEditor({
    extensions: [
      StarterKit, // Handles Bold, Italic, Bullet lists, Headers, etc.
      Typography, // Handles smart quotes, em-dashes
    ],
    content: '<p>Start writing your novel...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
        // ENABLES NATIVE SPELLCHECK (Red Squiggles)
        spellcheck: 'true', 
      },
    },
  })

  return (
    <div className="editor-container">
      {/* This renders the actual editable area */}
      <EditorContent editor={editor} />
    </div>
  )
}

export default Editor
