import React, { createContext, useContext, useState, ReactNode } from "react";

export type Persona = "VE" | "CFO" | "SalesRep" | "CSM";

interface PersonaContextType {
  persona: Persona;
  setPersona: (persona: Persona) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export const PersonaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [persona, setPersona] = useState<Persona>("VE");

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>{children}</PersonaContext.Provider>
  );
};

export const usePersona = () => {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error("usePersona must be used within a PersonaProvider");
  }
  return context;
};
