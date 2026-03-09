import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Upload, Save, FileText, AlertTriangle, BarChart, Calendar, Database } from 'lucide-react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SalesService, db } from '@/lib/db';

const BackupPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [salesReports, setSalesReports] = useState<Array<{id: string, name: string, date: string, total: number}>>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Load actual sales reports on component mount
  useEffect(() => {
    const loadSalesReports = async () => {
      try {
        // Get sales data from the database
        const allSales = await SalesService.getTodaysSales();
        
        if (!Array.isArray(allSales)) {
          console.error('Invalid sales data format');
          setSalesReports([]);
          return;
        }
        
        // Group sales by date for reporting
        const salesByDate = allSales.reduce((acc, sale) => {
          const date = new Date(sale.createdAt || new Date()).toISOString().split('T')[0];
          if (!acc[date]) {
            acc[date] = {
              total: 0,
              count: 0
            };
          }
          acc[date].total += sale.total;
          acc[date].count += 1;
          return acc;
        }, {} as Record<string, {total: number, count: number}>);
        
        // Convert to reports format
        const reports = Object.entries(salesByDate).map(([date, data], index) => ({
          id: String(index + 1),
          name: `Sales Report ${new Date(date).toLocaleDateString()}`,
          date,
          total: data.total
        }));
        
        setSalesReports(reports);
      } catch (error) {
        console.error('Error loading sales reports:', error);
        toast({
          title: 'Error',
          description: 'Failed to load sales reports',
          variant: 'destructive',
        });
        setSalesReports([]);
      }
    };
    
    loadSalesReports();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch actual data from database
      const sales = await db.sales.toArray();
      const products = await db.products.toArray();
      const staff = await db.staff.toArray();
      const users = await db.users.toArray();
      
      // Prepare backup data
      const backupData = {
        transactions: sales,
        inventory: products,
        staff: staff.map((s: any) => ({
          ...s,
          // Remove sensitive data
          passkey: undefined
        })),
        users: users.map((u: any) => ({
          ...u,
          // Remove sensitive data
          password: undefined
        })),
        settings: {
          businessName: users.find((u: any) => u.role === 'admin')?.businessName || '',
          ownerName: users.find((u: any) => u.role === 'admin')?.ownerName || ''
        },
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      // Create a blob and download it
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartpos_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Backup Exported',
        description: 'Your data has been successfully exported',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting your data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      // Get today's sales from the database
      const todaysSales = await SalesService.getTodaysSales();
      
      if (!Array.isArray(todaysSales)) {
        throw new Error('Invalid sales data format');
      }
      
      const todaysTotal = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
      
      // Create a real report based on actual data
      const newReport = {
        id: String(salesReports.length + 1),
        name: `Sales Report ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString().split('T')[0],
        total: todaysTotal
      };
      
      setSalesReports(prev => [newReport, ...prev]);
      
      toast({
        title: 'Report Generated',
        description: 'Your sales report has been generated successfully',
      });
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: 'Report Generation Failed',
        description: 'There was an error generating your report',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a backup file to import',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      // Read and parse the backup file
      const fileContent = await selectedFile.text();
      const parsedData = JSON.parse(fileContent);
      
      // Validate backup data structure
      if (!parsedData.transactions || !parsedData.inventory || !parsedData.timestamp) {
        throw new Error('Invalid backup file format');
      }
      
      // Clear existing data
      await db.sales.clear();
      await db.products.clear();
      
      // Restore transactions
      if (Array.isArray(parsedData.transactions)) {
        for (const sale of parsedData.transactions) {
          try {
            await db.sales.add({
              ...sale,
              // Ensure createdAt is a Date object
              createdAt: new Date(sale.createdAt)
            });
          } catch (saleError) {
            console.error('Error importing sale:', saleError);
          }
        }
      }
      
      // Restore inventory
      if (Array.isArray(parsedData.inventory)) {
        for (const product of parsedData.inventory) {
          try {
            await db.products.add({
              ...product,
              // Ensure dates are Date objects
              createdAt: new Date(product.createdAt),
              updatedAt: new Date(product.updatedAt || product.createdAt)
            });
          } catch (productError) {
            console.error('Error importing product:', productError);
          }
        }
      }
      
      // Restore staff (if present, without sensitive data)
      if (Array.isArray(parsedData.staff)) {
        // Don't restore staff passkeys - they need to be reset
        console.log(`Found ${parsedData.staff.length} staff records in backup`);
      }
      
      toast({
        title: 'Backup Imported',
        description: 'Your data has been successfully restored',
      });
      
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'There was an error importing your data',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-lg border-b dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setLocation('/profile-settings')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 dark:text-gray-300" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Backup & Restore</h1>
            <div className="w-10" />
          </div>
        </div>
        
        <div className="p-4 space-y-4 pb-20">
          {/* Quick Backup Button */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="w-full bg-[#FF8882] hover:bg-[#D89D9D] text-white p-6 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
              style={{
                boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
              }}
            >
              <Database className="w-5 h-5" />
              {isExporting ? 'Creating Backup...' : 'Backup Now'}
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-600 dark:text-blue-400">Important</AlertTitle>
              <AlertDescription className="text-blue-600 dark:text-blue-400">
                Backup your data regularly to prevent loss. Imported backups will overwrite existing data.
              </AlertDescription>
            </Alert>
            
            <Tabs defaultValue="reports" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="reports">Sales Reports</TabsTrigger>
                <TabsTrigger value="export">Export Data</TabsTrigger>
                <TabsTrigger value="import">Import Data</TabsTrigger>
              </TabsList>
              
              <TabsContent value="reports">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart className="w-5 h-5 mr-2 text-[#7D6C7D]" />
                      Sales Reports
                    </CardTitle>
                    <CardDescription>
                      Generate and view your sales reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button 
                        onClick={handleGenerateReport} 
                        disabled={isGeneratingReport}
                        className="w-full bg-[#7D6C7D] hover:bg-[#D89D9D] text-white mb-4"
                      >
                        {isGeneratingReport ? 'Generating...' : 'Generate New Report'}
                      </Button>
                      
                      {salesReports.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {salesReports.map(report => (
                            <div 
                              key={report.id} 
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 mr-2 text-gray-500" />
                                <div>
                                  <p className="font-medium text-gray-800 dark:text-gray-200">{report.name}</p>
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {report.date}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-[#FF8882]">₱{report.total.toFixed(2)}</p>
                                <button className="text-xs text-blue-500 hover:underline">
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p>No reports generated yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="export">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Download className="w-5 h-5 mr-2 text-[#FF8882]" />
                      Export Your Data
                    </CardTitle>
                    <CardDescription>
                      Create a backup file containing all your business data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">What's included in the backup:</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-5 list-disc">
                          <li>Transaction history</li>
                          <li>Inventory items and stock levels</li>
                          <li>Business settings and preferences</li>
                          <li>Staff accounts (excluding passwords)</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleExport} 
                      disabled={isExporting}
                      className="w-full bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                      style={{
                        boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
                      }}
                    >
                      {isExporting ? 'Exporting...' : 'Export Backup File'}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="import">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Upload className="w-5 h-5 mr-2 text-[#7D6C7D]" />
                      Import Backup
                    </CardTitle>
                    <CardDescription>
                      Restore your data from a previous backup file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-700 dark:text-yellow-500 font-medium">
                          Warning: Importing a backup will overwrite your current data. This action cannot be undone.
                        </p>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Select Backup File
                        </label>
                        <Input
                          type="file"
                          accept=".json"
                          onChange={handleFileSelect}
                          className="cursor-pointer"
                        />
                        {selectedFile && (
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleImport} 
                      disabled={isImporting || !selectedFile}
                      className="w-full bg-[#7D6C7D] hover:bg-[#D89D9D] text-white"
                      style={{
                        boxShadow: '0 4px 12px rgba(125, 108, 125, 0.3)',
                      }}
                    >
                      {isImporting ? 'Importing...' : 'Import Backup File'}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
};

export default BackupPage;