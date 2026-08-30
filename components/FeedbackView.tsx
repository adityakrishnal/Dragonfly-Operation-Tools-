
import React from 'react';
import { ArrowLeft, Mail, ExternalLink } from 'lucide-react';
import DragonflySignature from './DragonflyLogo';

interface FeedbackViewProps {
  onBack: () => void;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ onBack }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-right-4 duration-500 overflow-y-auto bg-slate-950 p-4">
      <div className="w-full max-w-xl mx-auto">
        <button 
          onClick={onBack}
          className="group flex items-center gap-2 text-gray-400 hover:text-dragonfly-turquoise mb-4 md:mb-6 transition-colors font-medium text-sm md:text-base"
        >
          <div className="p-1.5 md:p-2 rounded-full group-hover:bg-dragonfly-turquoise/10 border border-transparent group-hover:border-dragonfly-turquoise/30">
            <ArrowLeft size={18} />
          </div>
          Back to Dashboard
        </button>

        <div className="bg-slate-900 rounded-xl md:rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-center">
          <div className="bg-slate-950 p-6 md:p-10 text-white relative overflow-hidden border-b border-slate-800">
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-4">
                <DragonflySignature variant="turquoise" showStation={true} stationCode="KTCH" size="lg" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold mb-1 text-white">
                Contact & Feedback
              </h1>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-dragonfly-turquoise opacity-10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-dragonfly-blue opacity-10 rounded-full -ml-12 -mb-12 blur-3xl"></div>
          </div>

          <div className="p-6 md:p-10 flex flex-col items-center gap-4 md:gap-6">
              <p className="text-base md:text-lg text-gray-300 font-medium">
                  Email feedback to creator <span className="text-dragonfly-turquoise font-bold">Aditya Lavakumar</span>
              </p>
              
              <a 
                  href="mailto:mail2adityakrishna@gmail.com"
                  className="flex items-center gap-2 md:gap-3 text-base md:text-2xl font-bold text-white hover:text-dragonfly-turquoise transition-colors border-b-2 border-transparent hover:border-dragonfly-turquoise pb-1 break-all"
              >
                  mail2adityakrishna@gmail.com
                  <ExternalLink size={16} className="opacity-50 hidden md:block" />
              </a>

              <p className="text-gray-400 text-xs md:text-sm mt-2 bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-700">
                  Tap email to open your mail client
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;