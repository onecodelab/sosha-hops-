import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Briefcase, Coffee, ChefHat } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Phase 1: Reveal content slightly before intro finishes for smooth transition
    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, 2200);

    // Phase 2: Remove intro layer to allow interaction
    const introTimer = setTimeout(() => {
      setShowIntro(false);
    }, 2800);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(introTimer);
    };
  }, []);

  const roles = [
    { id: 'owner', label: 'Owner / Admin', icon: <Shield className="w-8 h-8 text-primary" />, desc: 'System Control' },
    { id: 'manager', label: 'Manager', icon: <Briefcase className="w-8 h-8 text-purple-400" />, desc: 'Operations' },
    { id: 'waiter', label: 'Waiter', icon: <Coffee className="w-8 h-8 text-orange-400" />, desc: 'Service' },
    { id: 'kitchen', label: 'Kitchen', icon: <ChefHat className="w-8 h-8 text-red-400" />, desc: 'KDS Display' },
  ];

  return (
    <>
      <style>{`
        @keyframes intro-pulse {
          0% { transform: scale(0.8); opacity: 0; }
          40% { transform: scale(1); opacity: 1; filter: brightness(1.2); }
          60% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-intro {
          animation: intro-pulse 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="min-h-screen bg-black overflow-hidden font-sans selection:bg-primary selection:text-white">
        
        {/* Intro Overlay */}
        {showIntro && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black pointer-events-none">
            <div className="relative w-32 h-32 md:w-48 md:h-48 animate-intro">
               <img 
                 src="https://aistudiocdn.com/uploads/image_c40e53a2-0941-45bd-895c-55b63777d206.png" 
                 alt="Sosha" 
                 className="w-full h-full object-contain drop-shadow-2xl"
               />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div 
          className={`min-h-screen flex flex-col items-center justify-center p-4 transition-all duration-1000 ${showContent ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}
        >
           {/* Header / Logo */}
           <div className="text-center space-y-8 mb-16 fade-in-up" style={{ animationDelay: '0ms' }}>
              <div className="w-24 h-24 mx-auto bg-gray-900/50 rounded-3xl p-5 border border-white/10 shadow-2xl backdrop-blur-sm">
                 <img 
                   src="https://aistudiocdn.com/uploads/image_c40e53a2-0941-45bd-895c-55b63777d206.png" 
                   alt="Sosha" 
                   className="w-full h-full object-contain"
                 />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter">Sosha OS</h1>
                <p className="text-gray-500 font-medium tracking-wide text-sm uppercase">Restaurant Operating System</p>
              </div>
           </div>

           {/* Roles Grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl px-4 fade-in-up" style={{ animationDelay: '200ms' }}>
              {roles.map((role, idx) => (
                <button
                  key={role.id}
                  onClick={() => navigate(`/login/${role.id}`)}
                  className="group relative bg-gray-900/40 hover:bg-gray-900 border border-white/5 hover:border-primary/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 text-left overflow-hidden"
                >
                  <div className="mb-4 p-3 bg-gray-950 rounded-xl inline-block group-hover:bg-primary/20 group-hover:text-white transition-colors border border-white/5">
                    {role.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 tracking-tight">{role.label}</h3>
                  <p className="text-sm text-gray-500 group-hover:text-gray-300 transition-colors">{role.desc}</p>
                  
                  {/* Subtle gradient glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-primary/10 transition-all duration-500" />
                </button>
              ))}
           </div>
           
           <div className="fixed bottom-8 text-gray-700 text-xs font-mono uppercase tracking-widest fade-in-up" style={{ animationDelay: '400ms' }}>
             powered by withramin.ai
           </div>
        </div>
      </div>
    </>
  );
};

export default Landing;