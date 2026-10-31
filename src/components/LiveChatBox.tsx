import React, { useEffect, useRef } from 'react';
import { TikTokChatMessage } from '../types';
import { MessageSquare } from 'lucide-react';

interface LiveChatBoxProps {
  messages: TikTokChatMessage[];
  connectedUsername: string | null;
  isLightMode?: boolean;
}

export const LiveChatBox: React.FC<LiveChatBoxProps> = ({
  messages,
  connectedUsername,
  isLightMode = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll the chat box to show most recent chat
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <aside
      aria-label="Live Chat Stream"
      className={`w-[280px] shrink-0 rounded-2xl border-2 border-[#137bcc] shadow-[0_0_24px_rgba(25,228,255,0.14)] flex flex-col h-[680px] sticky top-20 overflow-hidden ${
        isLightMode
          ? 'bg-white text-[#102c4b]'
          : 'bg-gradient-to-b from-[#06244b] to-[#03142f] text-[#f3f8ff]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1768b3]/50 bg-[#061c3d] text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-[#19e4ff] shrink-0" />
          <span className="text-xs font-extrabold tracking-wide truncate">
            Live Chat Stream
          </span>
        </div>
        {connectedUsername && (
          <span className="text-[11px] font-mono text-[#2bff86] truncate">
            @{connectedUsername.replace(/^@/, '')}
          </span>
        )}
      </div>

      {/* Chat Messages Only (No likes/gifts in chat box; shows profile picture + display name, not @ name) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 p-3 overflow-y-auto space-y-2.5 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-xs text-[#96b8dd]">
            <p>No chat messages yet.</p>
            <p className="mt-1 text-[11px] opacity-80">
              All live viewer chat messages (including multi-word comments and numbers) appear here in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const displayName = msg.nickname || 'Viewer';
            const initials = displayName.slice(0, 2).toUpperCase();
            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                  isLightMode
                    ? 'bg-[#f0f7ff] border-[#bbd5f0]'
                    : 'bg-[#020a25]/70 border-[#1768b3]/40'
                }`}
              >
                {msg.profilePictureUrl && msg.profilePictureUrl.startsWith('http') ? (
                  <img
                    src={msg.profilePictureUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-[#19e4ff] shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#061c3d] border border-[#19e4ff] flex items-center justify-center text-xs font-extrabold text-[#19e4ff] shrink-0">
                    {initials}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-[#19e4ff] truncate">
                    {displayName}
                  </div>
                  <div
                    className={`text-xs mt-0.5 break-words leading-snug ${
                      isLightMode ? 'text-[#102c4b]' : 'text-[#f3f8ff]'
                    }`}
                  >
                    {msg.comment}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
