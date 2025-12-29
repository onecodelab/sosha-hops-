
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, showToast } from '../components/ui';
import { SoshaLogo } from '../components/SoshaLogo';
import { ArrowLeft } from 'lucide-react';
import { SoshaBackground } from '../components/SoshaBackground';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Check if user was invited in profiles table
      const { data: invitation, error: inviteError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('invitation_pending', true)
        .maybeSingle();

      if (inviteError || !invitation) {
        throw new Error('No pending invitation found for this email. Please contact your manager.');
      }

      // 2. Create auth account
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

      if (authData.user) {
        // Wait for trigger to create profile
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Attempt manual link if trigger didn't finish
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, email')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (!profile) {
           const displayName = invitation.full_name || invitation.name || email.split('@')[0];
           await supabase.from('profiles').upsert({
              id: authData.user.id,
              email: email,
              full_name: displayName,
              name: displayName,
              role: invitation.role,
              invitation_pending: false
           });
        }

        showToast('Account created successfully!', 'success');
        navigate(`/login/${invitation.role}`);
      }

    } catch (error: any) {
      console.error("Signup error:", error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SoshaBackground variant="landing">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/90 border-border backdrop-blur-md rounded-3xl">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-20 h-20 mb-4 flex items-center justify-center">
                <SoshaLogo className="w-full h-full" />
            </div>
            <CardTitle className="text-2xl text-center text-foreground">
              Staff Sign Up
            </CardTitle>
            <p className="text-center text-muted text-sm">
              Enter your email to claim your invitation
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Email Address</label>
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-black/20 border-border text-foreground placeholder:text-muted focus:border-primary rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Create Password</label>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  className="bg-black/20 border-border text-foreground focus:border-primary rounded-xl"
                />
              </div>
              
              <Button type="submit" className="w-full font-bold text-black h-12 rounded-xl mt-2" isLoading={loading} disabled={loading}>
                {loading ? 'Creating Account...' : 'Complete Sign Up'}
              </Button>
              
              <div className="pt-4 border-t border-border text-center">
                  <Link to="/" className="text-sm text-muted hover:text-foreground transition-colors flex items-center justify-center gap-2">
                      <ArrowLeft className="w-4 h-4" /> Back to Home
                  </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </SoshaBackground>
  );
};

export default SignUp;
