import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = document.getElementById("main-scroll-area");
    if (!container) return;

    const onScroll = () => setVisible(container.scrollTop > 300);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      size="icon"
      className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg"
      onClick={() =>
        document.getElementById("main-scroll-area")?.scrollTo({ top: 0, behavior: "smooth" })
      }
      aria-label="Scroll naar boven"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
