import { createContext, ReactNode, useContext, useState } from "react";

interface DrawerContextType {
  isOpen: boolean;
  content: ReactNode | null;
  title: string;
  openDrawer: (title: string, content: ReactNode) => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [title, setTitle] = useState("");

  const openDrawer = (newTitle: string, newContent: ReactNode) => {
    setTitle(newTitle);
    setContent(newContent);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    setIsOpen(false);
  };

  return (
    <DrawerContext.Provider
      value={{ isOpen, content, title, openDrawer, closeDrawer }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}
