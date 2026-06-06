import { useState, useEffect } from "react";
import { pdf, PDFViewer } from "@react-pdf/renderer";
import ParkingLotFlyer from "@/components/templates/ParkingLotFlyer";
import { useBranding } from "@/contexts/BrandingContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default function Templates() {
  const { canAccess } = useSubscription();

  // Feature gate: Marketing/Templates requires 'professional' tier
  if (!canAccess("professional")) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="Marketing Templates"
        description="Access all marketing templates including flyers, door hangers, and branded materials to grow your painting business."
      />
    );
  }
  const { branding, isLoading: brandingLoading } = useBranding();

  const [companyName, setCompanyName] = useState(branding.businessName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#D4A017");
  const [isDownloading, setIsDownloading] = useState(false);

  // Load saved brand kit from the server
  const { data: brandKit } = trpc.brandKit.get.useQuery();
  const saveMutation = trpc.brandKit.save.useMutation({
    onError: (err) => toast.error(`Failed to save brand kit: ${err.message}`),
  });

  // Populate form: prefer persisted brand-kit values, fall back to branding context
  useEffect(() => {
    if (brandKit) {
      setCompanyName(brandKit.companyName ?? branding.businessName);
      setPhone(brandKit.phone ?? "");
      setEmail(brandKit.companyEmail ?? "");
      setWebsite(brandKit.website ?? "");
      if (brandKit.primaryColor) setPrimaryColor(brandKit.primaryColor);
    } else if (!brandingLoading) {
      setCompanyName((prev) => prev || branding.businessName);
    }
  }, [brandKit, brandingLoading, branding.businessName]);

  const flyerProps = { companyName, phone, email, website, primaryColor };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Persist before generating so the data is never lost
      await saveMutation.mutateAsync({
        companyName,
        companyEmail: email,
        phone,
        website,
        primaryColor,
      });

      const blob = await pdf(<ParkingLotFlyer {...flyerProps} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName || "flyer"}-parking-lot-flyer.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Brand kit saved and PDF downloaded.");
    } catch {
      // saveMutation.onError already shows a toast for save failures;
      // catch here prevents an unhandled rejection if pdf() itself throws
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Marketing Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize and download print-ready flyers for your business
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── Brand Kit Form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parking Lot Flyer</CardTitle>
            <CardDescription>
              Fill in your brand details — the preview updates live. Brand kit
              is saved automatically when you download.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="PaintersMax"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="www.company.com"
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="primaryColor">Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-transparent p-0.5 shrink-0"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono uppercase"
                  maxLength={7}
                  placeholder="#D4A017"
                />
              </div>
            </div>

            <Separator />

            <Button
              className="w-full"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? "Saving & Generating…" : "Download PDF"}
            </Button>
          </CardContent>
        </Card>

        {/* ── Live Preview ── */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PDFViewer width="100%" height={700} showToolbar={false}>
              <ParkingLotFlyer {...flyerProps} />
            </PDFViewer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
