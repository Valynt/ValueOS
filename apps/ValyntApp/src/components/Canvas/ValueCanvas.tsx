/**
 * ValueCanvas - Interactive canvas for value driver configuration
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
 *
=======
 * 
>>>>>>> Stashed changes
=======
 * 
>>>>>>> Stashed changes
=======
 * 
>>>>>>> Stashed changes
 * Features:
 * - Drag-and-drop value drivers from library
 * - Real-time calculation updates
 * - Auto-save to playground session
 * - Tenant-scoped operations
 */

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import React, { useState, useEffect, useCallback } from "react";
import { useDrop, useDrag } from "react-dnd";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValueDriverCard } from "./ValueDriverCard";
import { ValueDriverEditor } from "../valueDrivers/ValueDriverEditor";
import { calculationEngine } from "@/services/CalculationEngine";
import { PlaygroundSessionService } from "@/services/PlaygroundSessionService";
import { useOrganization } from "@/hooks/useOrganization";
import { ValueDriver, CanvasComponent, MOCK_VALUE_DRIVERS } from "@/types/valueDriver";
import { logger } from "@/lib/logger";
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
import React, { useState, useEffect, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { DndProvider } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ValueDriverCard } from './ValueDriverCard';
import { ValueDriverEditor } from '../valueDrivers/ValueDriverEditor';
import { calculationEngine } from '@/services/CalculationEngine';
import { PlaygroundSessionService } from '@/services/PlaygroundSessionService';
import { useOrganization } from '@/hooks/useOrganization';
import { ValueDriver, CanvasComponent } from '@/types/valueDriver';
import { logger } from '@/lib/logger';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

interface ValueCanvasProps {
  sessionId: string;
  onSave: () => void;
}

export const ValueCanvas: React.FC<ValueCanvasProps> = ({ sessionId, onSave }) => {
  const { organizationId } = useOrganization();
  const [drivers, setDrivers] = useState<ValueDriver[]>([]);
  const [canvasComponents, setCanvasComponents] = useState<CanvasComponent[]>([]);
  const [editingDriver, setEditingDriver] = useState<ValueDriver | null>(null);
  const [sessionService] = useState(() => new PlaygroundSessionService());

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await sessionService.loadSession(sessionId, organizationId);
        if (session?.data?.drivers) {
          setDrivers(session.data.drivers);
          setCanvasComponents(session.data.canvasComponents || []);
        }
      } catch (error) {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        logger.error("Failed to load session", { sessionId, organizationId, error });
=======
        logger.error('Failed to load session', { sessionId, organizationId, error });
>>>>>>> Stashed changes
=======
        logger.error('Failed to load session', { sessionId, organizationId, error });
>>>>>>> Stashed changes
=======
        logger.error('Failed to load session', { sessionId, organizationId, error });
>>>>>>> Stashed changes
      }
    };
    loadSession();
  }, [sessionId, organizationId, sessionService]);

  // Auto-save
  useEffect(() => {
    const autoSave = async () => {
      try {
        await sessionService.updateSession(sessionId, {
          data: { drivers, canvasComponents },
          organizationId,
        });
      } catch (error) {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        logger.error("Auto-save failed", { sessionId, error });
=======
        logger.error('Auto-save failed', { sessionId, error });
>>>>>>> Stashed changes
=======
        logger.error('Auto-save failed', { sessionId, error });
>>>>>>> Stashed changes
=======
        logger.error('Auto-save failed', { sessionId, error });
>>>>>>> Stashed changes
      }
    };
    const timeout = setTimeout(autoSave, 1000); // Auto-save after 1s
    return () => clearTimeout(timeout);
  }, [drivers, canvasComponents, sessionId, organizationId, sessionService]);

  const handleDrop = useCallback((item: { driver: ValueDriver }) => {
    const newDriver = { ...item.driver, id: `${item.driver.id}-${Date.now()}` };
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    setDrivers((prev) => [...prev, newDriver]);
    // Add to canvas components
    const component: CanvasComponent = {
      id: newDriver.id,
      type: "valueDriver",
      props: { driver: newDriver, value: newDriver.defaultValue },
      position: { x: 0, y: 0 }, // Default position
    };
    setCanvasComponents((prev) => [...prev, component]);
  }, []);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "valueDriver",
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    setDrivers(prev => [...prev, newDriver]);
    // Add to canvas components
    const component: CanvasComponent = {
      id: newDriver.id,
      type: 'valueDriver',
      props: { driver: newDriver, value: newDriver.defaultValue },
      position: { x: 0, y: 0 }, // Default position
    };
    setCanvasComponents(prev => [...prev, component]);
  }, []);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'valueDriver',
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    drop: handleDrop,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleEditDriver = (driver: ValueDriver) => {
    setEditingDriver(driver);
  };

  const handleSaveDriver = (updatedDriver: ValueDriver) => {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    setDrivers((prev) => prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d)));
    setCanvasComponents((prev) =>
      prev.map((c) =>
        c.id === updatedDriver.id ? { ...c, props: { ...c.props, driver: updatedDriver } } : c
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));
    setCanvasComponents(prev =>
      prev.map(c =>
        c.id === updatedDriver.id
          ? { ...c, props: { ...c.props, driver: updatedDriver } }
          : c
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      )
    );
    setEditingDriver(null);
  };

  const handleDeleteDriver = (driverId: string) => {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    setCanvasComponents((prev) => prev.filter((c) => c.id !== driverId));
  };

  const handleValueChange = (componentId: string, newValue: any) => {
    setCanvasComponents((prev) => {
      const updated = prev.map((c) =>
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    setDrivers(prev => prev.filter(d => d.id !== driverId));
    setCanvasComponents(prev => prev.filter(c => c.id !== driverId));
  };

  const handleValueChange = (componentId: string, newValue: any) => {
    setCanvasComponents(prev => {
      const updated = prev.map(c =>
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
        c.id === componentId ? { ...c, props: { ...c.props, value: newValue } } : c
      );
      // Trigger calculation cascade
      const updates = calculationEngine.calculateCascade(componentId, updated);
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
      updates.forEach((update) => {
        const index = updated.findIndex((c) => c.id === update.componentId);
        if (index !== -1) {
          updated[index] = {
            ...updated[index],
            props: { ...updated[index].props, value: update.newValue },
          };
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      updates.forEach(update => {
        const index = updated.findIndex(c => c.id === update.componentId);
        if (index !== -1) {
          updated[index] = { ...updated[index], props: { ...updated[index].props, value: update.newValue } };
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
        }
      });
      return [...updated];
    });
  };

  const handleExplicitSave = async () => {
    try {
      await sessionService.commitSession(sessionId, organizationId);
      onSave();
    } catch (error) {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
      logger.error("Explicit save failed", { sessionId, error });
    }
  };
  const LibraryDriverCard: React.FC<{ driver: ValueDriver }> = ({ driver }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: "valueDriver",
      item: { driver },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }));

    return (
      <Card ref={drag} className={`cursor-move ${isDragging ? "opacity-50" : ""}`}>
        <CardContent className="p-3">
          <div className="text-sm font-medium">{driver.name}</div>
          <div className="text-xs text-gray-500">{driver.description}</div>
        </CardContent>
      </Card>
    );
  };
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      logger.error('Explicit save failed', { sessionId, error });
    }
  };

<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full">
        <div
          ref={drop}
          className={`flex-1 p-4 border-2 border-dashed ${
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
            isOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canvasComponents.map((component) => (
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
            isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canvasComponents.map(component => (
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
              <ValueDriverCard
                key={component.id}
                component={component}
                onEdit={() => handleEditDriver(component.props.driver)}
                onDelete={() => handleDeleteDriver(component.id)}
                onValueChange={(value) => handleValueChange(component.id, value)}
              />
            ))}
          </div>
          {canvasComponents.length === 0 && (
            <div className="text-center text-gray-500">
              Drag value drivers here to start building your model
            </div>
          )}
        </div>
        <div className="w-80 p-4 border-l">
          <Button onClick={handleExplicitSave} className="w-full mb-4">
            Save to Backend
          </Button>
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
          <h3 className="text-lg font-semibold mb-2">Value Driver Library</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {MOCK_VALUE_DRIVERS.map((driver) => (
              <LibraryDriverCard key={driver.id} driver={driver} />
            ))}
          </div>
=======
          {/* Library or other controls */}
>>>>>>> Stashed changes
=======
          {/* Library or other controls */}
>>>>>>> Stashed changes
=======
          {/* Library or other controls */}
>>>>>>> Stashed changes
        </div>
      </div>
      {editingDriver && (
        <ValueDriverEditor
          driver={editingDriver}
          onSave={handleSaveDriver}
          onClose={() => setEditingDriver(null)}
        />
      )}
    </DndProvider>
  );
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
};
=======
};
>>>>>>> Stashed changes
=======
};
>>>>>>> Stashed changes
=======
};
>>>>>>> Stashed changes
