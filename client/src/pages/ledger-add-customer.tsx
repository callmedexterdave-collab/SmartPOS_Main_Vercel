import React, { useRef, useState } from "react";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CreditorService } from "@/lib/db";
import { ArrowLeft, User, Phone, MapPin, Upload, Image, Frown, Smile } from "lucide-react";

export default function LedgerAddCustomer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [rating, setRating] = useState<"bad" | "good" | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Missing name", description: "Please enter creditor name", variant: "destructive" });
      return;
    }

    try {
      const description = JSON.stringify({ phone: phone.trim(), address: address.trim(), rating });
      await CreditorService.addCreditor({ name: name.trim(), amount: 0, description, dueDate: null, reminderDate: null, isPaid: false });
      toast({ title: "Saved", description: "Creditor added" });
      setLocation("/ledger");
    } catch (e) {
      toast({ title: "Failed", description: "Unable to add creditor", variant: "destructive" });
    }
  };

  return (
    <Layout fullWidth>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full flex items-center justify-center">
        <div className="w-full sm:w-[95%] md:w-[90%] lg:w-[85%] xl:w-[80%] mx-auto my-2">
          <div className="px-2 sm:px-4 pt-6">
            <div className="flex items-center justify-between mb-6">
              <button aria-label="Go back" className="p-3 rounded-full bg-white shadow-sm border border-gray-200" onClick={async () => {
                try {
                  console.log("Navigating to ledger route");
                  setLocation("/ledger");
                  console.log("Successfully navigated to ledger route");
                } catch (e) {
                  console.error("Failed to navigate to ledger route", e);
                  toast({ title: "Navigation Error", description: "Unable to navigate to ledger", variant: "destructive" });
                }
              }}> 
                <motion.div whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </motion.div>
              </button>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">REGISTER A CREDITORS</div>
              </div>
              <div className="w-10" />
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer Name"
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-500" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09173029999"
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-500" />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Customer Address"
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 shadow-sm p-6 flex flex-col items-center justify-center">
                <Image className="w-12 h-12 text-gray-400" aria-label="Avatar placeholder" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setImage(f);
                  }}
                />
                <button
                  className="mt-4 px-4 py-2 rounded-full border border-purple-500 text-purple-600 bg-white shadow-sm flex items-center gap-2"
                  aria-label="Upload ID or Picture"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  Upload ID/Picture
                </button>
                {image && (
                  <div className="mt-2 text-xs text-gray-600">{image.name}</div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">Credit Rating:</div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setRating("bad")}
                    aria-pressed={rating === "bad"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${rating === "bad" ? "border-pink-500 bg-pink-50" : "border-gray-200 bg-white"}`}
                  >
                    <Frown className="w-5 h-5 text-pink-500" />
                    <span className="text-gray-800">Bad</span>
                  </button>
                  <button
                    onClick={() => setRating("good")}
                    aria-pressed={rating === "good"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${rating === "good" ? "border-black bg-gray-50" : "border-gray-200 bg-white"}`}
                  >
                    <Smile className="w-5 h-5 text-gray-900" />
                    <span className="text-gray-800">Good</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="flex-1 py-3 rounded-2xl bg-purple-600 text-white font-bold shadow-md"
                  onClick={() => setLocation("/ledger")}
                >
                  CANCEL
                </button>
                <button
                  className="flex-1 py-3 rounded-2xl bg-pink-500 text-white font-bold shadow-md"
                  onClick={handleSave}
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
