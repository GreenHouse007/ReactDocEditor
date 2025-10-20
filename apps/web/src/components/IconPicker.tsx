import { useEffect, useRef } from "react";

interface IconPickerProps {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
  triggerRef: HTMLButtonElement | null;
}

const ICONS = [
  "📄",
  "📝",
  "📖",
  "📚",
  "📕",
  "📗",
  "📘",
  "📙",
  "🌍",
  "🌎",
  "🌏",
  "🗺️",
  "🏰",
  "🏛️",
  "🏔️",
  "🌋",
  "⚔️",
  "🗡️",
  "🛡️",
  "🏹",
  "🔮",
  "✨",
  "🌟",
  "💫",
  "👑",
  "💎",
  "🔱",
  "⚡",
  "🔥",
  "💧",
  "🌊",
  "❄️",
  "🐉",
  "🦅",
  "🦁",
  "🐺",
  "🦊",
  "🦉",
  "🦇",
  "🕷️",
  "👤",
  "👥",
  "🧙",
  "🧝",
  "🧛",
  "🧟",
  "👻",
  "🤖",
  "🎭",
  "🎨",
  "🎪",
  "🎬",
  "🎮",
  "🎲",
  "🎯",
  "🎰",
];

export function IconPicker({
  currentIcon,
  onSelect,
  onClose,
  triggerRef,
}: IconPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (triggerRef && pickerRef.current) {
      const rect = triggerRef.getBoundingClientRect();
      pickerRef.current.style.top = `${rect.top}px`;
      pickerRef.current.style.left = `${rect.right + 8}px`;
    }
  }, [triggerRef]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={pickerRef}
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 w-64"
      >
        <div className="text-xs text-gray-400 mb-2 font-semibold">
          Choose an icon
        </div>
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => {
                onSelect(icon);
                onClose();
              }}
              className={`
                w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 text-xl
                ${icon === currentIcon ? "bg-blue-600" : ""}
              `}
            >
              {icon}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            onSelect("📄");
            onClose();
          }}
          className="w-full mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
        >
          Remove Icon
        </button>
      </div>
    </>
  );
}
