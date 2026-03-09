import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthService } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

const AdminLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });
  
  // Load saved credentials on component mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('admin_username');
    const savedPassword = localStorage.getItem('admin_password');
    const rememberMeState = localStorage.getItem('admin_remember_me') === 'true';
    
    if (savedUsername && savedPassword && rememberMeState) {
      form.setValue('username', savedUsername);
      form.setValue('password', savedPassword);
      form.setValue('rememberMe', rememberMeState);
    }
  }, [form]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const user = await AuthService.loginAdmin(data.username.trim(), data.password);
      if (user) {
        // Save or clear credentials based on remember me checkbox
        if (data.rememberMe) {
          localStorage.setItem('admin_username', data.username.trim());
          localStorage.setItem('admin_password', data.password);
          localStorage.setItem('admin_remember_me', 'true');
        } else {
          // Clear saved credentials if remember me is unchecked
          localStorage.removeItem('admin_username');
          localStorage.removeItem('admin_password');
          localStorage.removeItem('admin_remember_me');
        }
        
        login(user);
        toast({
          title: 'Welcome back!',
          description: `Logged in as ${user.businessName || 'Admin'}`,
        });
        // Always go to dashboard for first-time or returning users
        setLocation('/admin-dashboard');
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid username or password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white"
    >
      <div className="p-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8 pt-8"
        >
          <Shield className="w-16 h-16 text-primary-500 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
          <p className="text-gray-600 mt-2">Access your business dashboard</p>
        </motion.div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Mobile Number / Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your mobile number"
                      data-testid="input-username"
                      className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        data-testid="input-password"
                        className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all pr-12"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                        className="absolute right-4 top-4 text-gray-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-between items-center mt-2">
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-remember-me"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-gray-600 font-medium cursor-pointer">
                        Remember me
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <button
                type="button"
                onClick={() => setLocation('/forgot-password')}
                data-testid="button-forgot-password"
                className="text-[#FF8882] text-sm font-medium hover:text-[#D89D9D] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-login"
              className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
              style={{
                boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
              }}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>
        
        <div className="text-center mt-6">
          <span className="text-gray-500">Don't have an account?</span>
          <button
            onClick={() => setLocation('/admin-signup')}
            data-testid="button-go-signup"
            className="text-[#FF8882] font-semibold ml-1 hover:text-[#D89D9D] transition-colors"
          >
            Sign Up
          </button>
        </div>
        
        <button
          onClick={() => setLocation('/role-selection')}
          data-testid="button-back"
          className="mt-6 text-gray-400 flex items-center touch-feedback"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>
    </motion.div>
  );
};

export default AdminLogin;
