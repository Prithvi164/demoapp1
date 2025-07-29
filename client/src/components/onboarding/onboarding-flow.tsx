import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, ChevronRight, Lightbulb, Target, Users } from "lucide-react";

const slides = [
  {
    title: "Welcome to Your Learning Journey",
    description: "Let's get you started with our intelligent learning management system.",
    Icon: Lightbulb,
    color: "bg-blue-500"
  },
  {
    title: "Track Your Progress",
    description: "Monitor your learning progress and achievements in real-time.",
    Icon: Target,
    color: "bg-green-500"
  },
  {
    title: "Join Learning Batches",
    description: "Collaborate with peers in structured learning batches.",
    Icon: Users,
    color: "bg-purple-500"
  }
];

export function OnboardingFlow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user, updateUser } = useAuth();

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/users/${user?.id}/complete-onboarding`
      );
      return response.json();
    },
    onSuccess: (updatedUser) => {
      // Update the user data in auth context to reflect completed onboarding
      if (updateUser) {
        updateUser(updatedUser);
      }
    }
  });

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(curr => curr + 1);
    } else {
      completeMutation.mutate();
    }
  };

  const CurrentIcon = slides[currentSlide].Icon;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className={`p-3 rounded-full ${slides[currentSlide].color}`}
              >
                <CurrentIcon className="w-8 h-8 text-white" />
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold"
              >
                {slides[currentSlide].title}
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground"
              >
                {slides[currentSlide].description}
              </motion.p>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="flex space-x-2">
                {slides.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide ? "bg-primary" : "bg-primary/20"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={handleNext}
                disabled={completeMutation.isPending}
              >
                {currentSlide === slides.length - 1 ? (
                  completeMutation.isPending ? (
                    "Completing..."
                  ) : (
                    <>
                      Get Started
                      <Check className="ml-2 w-4 h-4" />
                    </>
                  )
                ) : (
                  <>
                    Next
                    <ChevronRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}