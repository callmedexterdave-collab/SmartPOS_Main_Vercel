import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Calculator, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface FloatingActionButtonProps {
  onTutorialClick?: () => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onTutorialClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState('');
  const [calculatorResult, setCalculatorResult] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ expr: string; result: string; ts: number }>>(() => {
    try {
      const raw = localStorage.getItem('calculator-history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const { toast } = useToast();

  const handleMainButtonClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleTutorialClick = () => {
    setIsExpanded(false);
    onTutorialClick?.();
    toast({
      title: 'Tutorial Started',
      description: 'Follow the guided tour to learn about the app features',
    });
  };

  const handleCalculatorClick = () => {
    setIsExpanded(false);
    setShowCalculator(true);
  };

  const calculateResult = () => {
    try {
      // Basic calculator functionality using Function instead of eval for safety
      // This creates a function that calculates the expression safely
      const result = Function('return ' + calculatorValue)();
      setCalculatorResult(result.toString());
      const entry = { expr: calculatorValue, result: result.toString(), ts: Date.now() };
      setHistoryItems(prev => {
        const next = [entry, ...prev].slice(0, 50);
        localStorage.setItem('calculator-history', JSON.stringify(next));
        return next;
      });
    } catch (error) {
      setCalculatorResult('Error');
    }
  };

  const clearCalculator = () => {
    setCalculatorValue('');
    setCalculatorResult('');
  };

  const deleteLastCharacter = () => {
    setCalculatorValue(prev => prev.slice(0, -1));
  };

  const addToCalculator = (value: string) => {
    setCalculatorValue(prev => prev + value);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-28 right-6 z-50">
        <AnimatePresence>
          {/* Tutorial Button */}
          {isExpanded && (
            <motion.div
              initial={{ scale: 0, y: 0, opacity: 0 }}
              animate={{ scale: 1, y: -80, opacity: 1 }}
              exit={{ scale: 0, y: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 right-0"
            >
              <Button
                onClick={handleTutorialClick}
                className="w-14 h-14 bg-[#7D6C7D] text-white rounded-full shadow-lg hover:bg-[#D89D9D] transition-colors"
                style={{
                  boxShadow: '0 4px 12px rgba(125, 108, 125, 0.3)',
                }}
                title="Start Tutorial"
              >
                <Play className="w-6 h-6" />
              </Button>
            </motion.div>
          )}

          {/* Calculator Button */}
          {isExpanded && (
            <motion.div
              initial={{ scale: 0, y: 0, opacity: 0 }}
              animate={{ scale: 1, y: -160, opacity: 1 }}
              exit={{ scale: 0, y: 0, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="absolute bottom-0 right-0"
            >
              <Button
                onClick={handleCalculatorClick}
                className="w-14 h-14 bg-[#D89D9D] text-white rounded-full shadow-lg hover:bg-[#FF8882] transition-colors"
                style={{
                  boxShadow: '0 4px 12px rgba(216, 157, 157, 0.3)',
                }}
                title="Calculator"
              >
                <Calculator className="w-6 h-6" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          onClick={handleMainButtonClick}
          className="w-14 h-14 bg-[#FF8882] text-white rounded-full shadow-lg hover:bg-[#D89D9D] transition-colors flex items-center justify-center"
          style={{
            boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
          }}
          title="Quick Actions"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-[#FF8882]" />
                Calculator
              </span>
              <button
                aria-label="Show history"
                className="p-2 rounded-md hover:bg-gray-100"
                onClick={() => setShowHistory(v => !v)}
                title="Toggle history"
              >
                <History className="w-5 h-5 text-gray-600" />
              </button>
            </DialogTitle>
          </DialogHeader>
          
          <motion.div drag dragMomentum={false} className="space-y-4">
            {/* Display */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-right text-sm text-gray-600 mb-1">
                {calculatorValue || '0'}
              </div>
              <div className="text-right text-2xl font-bold text-gray-800">
                {calculatorResult || '0'}
              </div>
            </div>

            {showHistory && (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">History</div>
                  <button
                    className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50"
                    onClick={() => {
                      setHistoryItems([]);
                      localStorage.removeItem('calculator-history');
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-40 overflow-auto">
                  {historyItems.length > 0 ? (
                    historyItems.map((h, i) => (
                      <div key={i} className="flex items-center justify-between py-1 text-sm">
                        <div className="text-gray-600">{h.expr}</div>
                        <div className="font-medium text-gray-800">{h.result}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500">No history</div>
                  )}
                </div>
              </div>
            )}

            {/* Calculator Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <Button
                onClick={clearCalculator}
                className="bg-red-500 hover:bg-red-600 text-white h-12"
              >
                C
              </Button>
              <Button
                onClick={deleteLastCharacter}
                className="bg-gray-500 hover:bg-gray-600 text-white h-12"
              >
                ←
              </Button>
              <Button
                onClick={() => addToCalculator('%')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                %
              </Button>
              <Button
                onClick={() => addToCalculator('/')}
                className="bg-[#FF8882] hover:bg-[#D89D9D] text-white h-12"
              >
                ÷
              </Button>

              {/* Row 2 */}
              <Button
                onClick={() => addToCalculator('7')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                7
              </Button>
              <Button
                onClick={() => addToCalculator('8')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                8
              </Button>
              <Button
                onClick={() => addToCalculator('9')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                9
              </Button>
              <Button
                onClick={() => addToCalculator('*')}
                className="bg-[#FF8882] hover:bg-[#D89D9D] text-white h-12"
              >
                ×
              </Button>

              {/* Row 3 */}
              <Button
                onClick={() => addToCalculator('4')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                4
              </Button>
              <Button
                onClick={() => addToCalculator('5')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                5
              </Button>
              <Button
                onClick={() => addToCalculator('6')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                6
              </Button>
              <Button
                onClick={() => addToCalculator('-')}
                className="bg-[#FF8882] hover:bg-[#D89D9D] text-white h-12"
              >
                -
              </Button>

              {/* Row 4 */}
              <Button
                onClick={() => addToCalculator('1')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                1
              </Button>
              <Button
                onClick={() => addToCalculator('2')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                2
              </Button>
              <Button
                onClick={() => addToCalculator('3')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                3
              </Button>
              <Button
                onClick={() => addToCalculator('+')}
                className="bg-[#FF8882] hover:bg-[#D89D9D] text-white h-12"
              >
                +
              </Button>

              {/* Row 5 */}
              <Button
                onClick={() => addToCalculator('0')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12 col-span-2"
              >
                0
              </Button>
              <Button
                onClick={() => addToCalculator('.')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 h-12"
              >
                .
              </Button>
              <Button
                onClick={calculateResult}
                className="bg-[#7D6C7D] hover:bg-[#D89D9D] text-white h-12"
              >
                =
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingActionButton;
