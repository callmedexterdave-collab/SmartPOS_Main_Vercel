import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/db';

const forgotPasswordSchema = z.object({
  username: z.string().min(1, 'Mobile number or username is required'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      // Request password reset using AuthService
      const success = await AuthService.requestPasswordReset(data.username.trim());
      
      if (success) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setResetSent(true);
        toast({
          title: 'Reset Link Sent',
          description: `Password reset instructions have been sent to your registered contact information.`,
        });
      } else {
        toast({
          title: 'Account Not Found',
          description: 'No account found with that mobile number or username.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred during password reset',
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
          <h2 className="text-2xl font-bold text-gray-800">Forgot Password</h2>
          <p className="text-gray-600 mt-2">
            {resetSent 
              ? 'Check your email or phone for reset instructions' 
              : 'Enter your mobile number or username to reset your password'}
          </p>
        </motion.div>
        
        {!resetSent ? (
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
                        placeholder="Enter your mobile number or username"
                        data-testid="input-username-reset"
                        className="p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-reset-password"
                className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
                style={{
                  boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
                }}
              >
                {isLoading ? 'Processing...' : 'Reset Password'}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-6">
              We've sent password reset instructions to your registered contact information.
              Please check your email or phone for further instructions.
            </p>
            <Button
              onClick={() => setLocation('/admin-login')}
              data-testid="button-back-to-login"
              className="bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] touch-feedback"
              style={{
                boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
              }}
            >
              Back to Login
            </Button>
          </div>
        )}
        
        <button
          onClick={() => setLocation('/admin-login')}
          data-testid="button-back"
          className="mt-6 text-gray-400 flex items-center touch-feedback"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </button>
      </div>
    </motion.div>
  );
};

export default ForgotPassword;