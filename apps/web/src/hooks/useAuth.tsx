import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'sales' | 'manager';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isAdmin: boolean;
  isManager: boolean;
  isSales: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }

    return (data || []).map(r => r.role as AppRole);
  };

  const processInvitation = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_team_invitation', {
        _user_id: userId,
        _email: email
      });

      if (error) {
        console.error('Error processing invitation:', error);
        return;
      }

      const result = data as { accepted?: boolean; tenant_id?: string } | null;
      if (result?.accepted) {
        console.log('Invitation accepted, joined tenant:', result.tenant_id);
      }
    } catch (err) {
      console.error('Error in processInvitation:', err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id).then(setRoles);
          }, 0);
        } else {
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Process any pending invitations for this user
        if (session.user.email) {
          processInvitation(session.user.id, session.user.email);
        }
        
        fetchUserRoles(session.user.id).then(userRoles => {
          setRoles(userRoles);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const value: AuthContextType = {
    user,
    session,
    roles,
    isAdmin: hasRole('admin'),
    isManager: hasRole('manager'),
    isSales: hasRole('sales'),
    isLoading,
    signOut,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
