import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
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

const staffLoginSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  passkey: z.string().min(1, 'Passkey is required'),
  rememberMe: z.boolean().optional().default(false),
});

type StaffLoginFormData = z.infer<typeof staffLoginSchema>;

const StaffLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginStaff } = useAuth();
  const { toast } = useToast();

  const form = useForm<StaffLoginFormData>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: {
      staffId: '',
      passkey: '',
      rememberMe: true,
    },
  });
  
  // Load saved credentials on component mount
  useEffect(() => {
    const savedStaffId = localStorage.getItem('staff_id');
    const savedPasskey = localStorage.getItem('staff_passkey');
    const rememberMeState = localStorage.getItem('staff_remember_me') === 'true';
    
    if (savedStaffId && savedPasskey && rememberMeState) {
      form.setValue('staffId', savedStaffId);
      form.setValue('passkey', savedPasskey);
      form.setValue('rememberMe', rememberMeState);
    }
  }, [form]);

  const handleSuccessfulLogin = async (user: any, data: StaffLoginFormData) => {
    // Save or clear credentials based on remember me checkbox
    if (data.rememberMe) {
      localStorage.setItem('staff_id', data.staffId.trim());
      localStorage.setItem('staff_passkey', data.passkey);
      localStorage.setItem('staff_remember_me', 'true');
    } else {
      // Clear saved credentials if remember me is unchecked
      localStorage.removeItem('staff_id');
      localStorage.removeItem('staff_passkey');
      localStorage.removeItem('staff_remember_me');
    }
    
    // Note: login() is handled by loginStaff in AuthContext
    
    toast({
      title: 'Welcome!',
      description: `Logged in as ${user.name || 'Staff Member'}`,
    });
    setLocation('/scanner');
  };

  const onSubmit = async (data: StaffLoginFormData) => {
    setIsLoading(true);
    try {
      await loginStaff(data.staffId.trim(), data.passkey);
      
      // Get user from updated context or just proceed (context updates automatically)
      // We can assume success if no error was thrown
      // We construct a minimal user object for the welcome message if needed, 
      // or rely on the context state in the next render cycle.
      // For the toast, we can just say "Staff Member" or fetch the user name if loginStaff returned it.
      // But loginStaff returns Promise<void>.
      // Let's trust the toast or just use a generic message if we don't have the user object handy here.
      // actually, loginStaff stores it in context.
      
      await handleSuccessfulLogin({ name: 'Staff Member' }, data); 
      
    } catch (error) {
      console.error('Staff login error:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials or network error',
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
          <User className="w-16 h-16 text-gray-600 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Staff Login</h2>
          <p className="text-gray-600 mt-2">Enter your staff credentials</p>
        </motion.div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Staff ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your staff ID"
                      data-testid="input-staff-id"
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
              name="passkey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Passkey</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your passkey"
                        data-testid="input-passkey"
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
            
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-2">
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
            
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-staff-login"
              className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
              style={{
                boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
              }}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>
        
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

export default StaffLogin;
