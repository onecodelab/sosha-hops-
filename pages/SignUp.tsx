import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, showToast } from '../components/ui';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { BaroBackground } from '../components/BaroBackground';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-organization', {
        body: {
          email,
          password,
          organizationName: orgName,
          fullName
        }
      });

      if (error || data.error) throw new Error(error?.message || data.error);

      showToast('Business setup complete! Welcome to the OS.', 'success');
      navigate('/login/owner');

    } catch (error: any) {
      console.error("Signup error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaroBackground variant="landing">
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden liquid-bg">
        {/* Atmospheric Glow Overlay */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="w-full max-w-xl relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <BaroLogo3D size="sm" animate />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-3 text-white">
              Launch your <br />
              <span className="serif-ital text-brand-green lowercase">operation</span>
            </h1>
            <p className="mono-os text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
              Protocol 01: The Source Initialization
            </p>
          </div>

          <Card className="bg-black/60 border border-white/10 backdrop-blur-3xl rounded-[3rem] shadow-2xl shadow-black overflow-hidden">
            <CardContent className="p-10 sm:p-14">
              <form onSubmit={handleSignUp} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">
                    Establishment Name
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Blue Nile Bistro"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-brand-yellow/20 transition-all font-bold placeholder:font-normal placeholder:opacity-20"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">Full Name</label>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-brand-yellow/20 transition-all font-bold placeholder:font-normal placeholder:opacity-20"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">Email Address</label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-brand-yellow/20 transition-all font-bold placeholder:font-normal placeholder:opacity-20"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.3em] ml-1">Secret Key (Password)</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 text-white rounded-2xl h-14 px-6 focus:ring-brand-yellow/20 transition-all font-bold placeholder:font-normal placeholder:opacity-20"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-xs h-16 rounded-2xl mt-4 shadow-2xl shadow-brand-yellow/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 ripple-link"
                  isLoading={loading}
                  disabled={loading}
                >
                  {loading ? 'Securing Access...' : (
                    <>
                      Start Free Trial
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="pt-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <Link to="/" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2 group">
                    <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Terminal
                  </Link>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Already operational? <Link to="/login/owner" className="text-brand-yellow hover:underline ml-1">Sign In</Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Bottom badge */}
          <div className="mt-12 flex items-center justify-center gap-2 opacity-30">
            <CheckCircle2 className="w-3 h-3 text-brand-green" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
              End-to-end encryption active
            </span>
          </div>
        </div>
      </div>
    </BaroBackground>
  );
};

export default SignUp;
