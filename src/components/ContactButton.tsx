import React from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle } from "lucide-react";

interface ContactButtonProps {
  phoneNumber: string;
}

const ContactButton: React.FC<ContactButtonProps> = ({ phoneNumber }) => {
  const openWhatsApp = () => {
    const cleaned = phoneNumber.replace(/[\D]/g, "");
    const formatted = cleaned.startsWith("0") ? `966${cleaned.slice(1)}` : cleaned;
    window.open(`https://wa.me/${formatted}`, "_blank");
  };

  const callPhone = () => {
    window.open(`tel:${phoneNumber}`, "_self");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="icon" onClick={openWhatsApp} title="Send WhatsApp Message">
        <MessageCircle className="w-5 h-5 text-green-500" />
      </Button>
      <Button variant="outline" size="icon" onClick={callPhone} title="Call">
        <Phone className="w-5 h-5 text-blue-500" />
      </Button>
    </div>
  );
};

export default ContactButton;
