import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    suggestions: string[];
    onSelect: (suggestion: string) => void;
    onAdd: () => void;
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, suggestions, onSelect, onAdd, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ top: y, left: x, visibility: 'hidden' });

    useLayoutEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;

            // Check right edge
            if (x + rect.width > window.innerWidth) {
                newX = x - rect.width;
            }

            // Check bottom edge
            if (y + rect.height > window.innerHeight) {
                newY = y - rect.height;
            }

            // Ensure not off-screen top/left
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);

            setStyle({ top: newY, left: newX, visibility: 'visible' });
        }
    }, [x, y, suggestions]); // Recalculate if suggestions change (height changes)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={style}
        >
            {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                    <div
                        key={index}
                        className="context-menu-item"
                        onClick={() => onSelect(suggestion)}
                    >
                        {suggestion}
                    </div>
                ))
            ) : (
                <div className="context-menu-item disabled">No suggestions</div>
            )}
            <div className="context-menu-separator" />
            <div className="context-menu-item" onClick={onAdd}>
                Add to Dictionary
            </div>
        </div>
    );
};

export default ContextMenu;
