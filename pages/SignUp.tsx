
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, showToast } from '../components/ui';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { ArrowLeft, Building2, UserCircle2 } from 'lucide-react';
import { BaroBackground } from '../components/BaroBackground';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'business' | 'staff'>('business');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'staff') {
        // --- Staff Signup Logic (Existing) ---
        const { data: invitation, error: inviteError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .eq('invitation_pending', true)
          .maybeSingle();

        if (inviteError || !invitation) {
          throw new Error('No pending invitation found for this email. Please contact your manager.');
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: invitation.full_name || invitation.name,
              role: invitation.role
            }
          }
        });

        if (signUpError) throw signUpError;
        showToast('Staff account created! Please log in.', 'success');
        navigate(`/login/${invitation.role}`);
      } else {
        // --- New Business Signup Logic (Edge Function) ---
        const { data, error } = await supabase.functions.invoke('create-organization', {
          body: {
            email,
            password,
            organizationName: orgName,
            fullName
          }
        });

        if (error || data.error) throw new Error(error?.message || data.error);

        showToast('Business setup complete! Please log in.', 'success');

        // After Edge Function creation, we sign them in automatically or redirect to login.
        // For security/cleanliness, redirect to login.
        navigate('/login/owner');
      }

    } catch (error: any) {
      console.error("Signup error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaroBackground variant="landing">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/90 border-border backdrop-blur-xl rounded-3xl shadow-2xl">
          <CardHeader className="space-y-1 flex flex-col items-center pb-2">
            <div className="scale-75 mb-2">
              <BaroLogo3D size="sm" />
            </div>
            <CardTitle className="text-2xl text-center font-black uppercase tracking-tighter italic">
              {mode === 'business' ? 'Start Your Business' : 'Staff Sign Up'}
            </CardTitle>
            <p className="text-center text-muted text-[10px] font-bold uppercase tracking-widest">
              {mode === 'business' ? 'Set up your restaurant OS in seconds' : 'Claim your invitation to join a team'}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Mode Selector */}
            <div className="flex p-1 bg-muted/50 rounded-xl border border-border">
              <button
                onClick={() => setMode('business')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'business' ? 'bg-primary text-black' : 'text-muted hover:text-foreground'}`}
              >
                <Building2 className="w-4 h-4" /> Business
              </button>
              <button
                onClick={() => setMode('staff')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'staff' ? 'bg-primary text-black' : 'text-muted hover:text-foreground'}`}
              >
                <UserCircle2 className="w-4 h-4" /> Staff
              </button>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              {mode === 'business' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Company Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. Blue Nile Bistro"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                    className="bg-black/20 border-border text-foreground rounded-xl h-11"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Full Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="bg-black/20 border-border text-foreground rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-black/20 border-border text-foreground rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  className="bg-black/20 border-border text-foreground rounded-xl h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-[11px] h-12 rounded-xl mt-4 shadow-xl shadow-primary/10"
                isLoading={loading}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : (mode === 'business' ? 'Start Free Trial' : 'Complete Sign Up')}
              </Button>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <Link to="/" className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-foreground transition-colors flex items-center gap-2">
                  <ArrowLeft className="w-3 h-3" /> Home
                </Link>
                <Link to="/login/owner" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                  Sign In instead
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </BaroBackground>
  );
};

export default SignUp;
