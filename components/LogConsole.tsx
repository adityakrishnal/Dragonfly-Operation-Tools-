
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal, Check, AlertTriangle, Info, XCircle, User } from 'lucide-react';

interface LogConsoleProps {
  logs: LogEntry[];
  userName?: string;
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs, userName }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check size={14} className="text-dragonfly-turquoise" />; // Success -> Turquoise
      case 'error': return <XCircle size={14} className="text-dragonfly-red" />;       // Error -> Red
      case 'warning': return <AlertTriangle size={14} className="text-dragonfly-orange" />; // Warning -> Orange
      default: return <Info size={14} className="text-dragonfly-lightblue" />;         // Info -> Light Blue
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-dragonfly-turquoise';
      case 'error': return 'text-dragonfly-red';
      case 'warning': return 'text-dragonfly-orange';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e293b] rounded-none overflow-hidden border-l-4 border-dragonfly-turquoise">
      <div className="flex items-center justify-between px-5 py-4 bg-[#0f172a] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-dragonfly-turquoise" />
          <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
            System Log
            {userName && (
              <span className="normal-case text-dragonfly-turquoise/70 bg-dragonfly-turquoise/10 px-2 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                User: {userName}
              </span>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-dragonfly-red"></div>
          <div className="w-2 h-2 rounded-full bg-dragonfly-orange"></div>
          <div className="w-2 h-2 rounded-full bg-dragonfly-turquoise"></div>
        </div>
      </div>
      
      <div className="flex-1 p-5 overflow-y-auto font-mono text-sm scrollbar-thin">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <p className="opacity-50">Waiting for input...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-4 animate-in fade-in slide-in-from-left-2 duration-300 group hover:bg-white/5 p-1 rounded">
                <span className="text-gray-500 text-[10px] mt-1 shrink-0 select-none w-16">
                  {log.timestamp}
                </span>
                <span className="mt-1 shrink-0">
                  {getIcon(log.type)}
                </span>
                <span className={`${getColor(log.type)} break-all leading-relaxed`}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default LogConsole;
