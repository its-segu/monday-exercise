import React, { useCallback, useState } from "react";
import { TabList, Tab, Button, IconButton } from "@vibe/core";
import { Dashboard } from "@vibe/icons";
import "@vibe/core/tokens";
import "./App.css";
import KanbanView from "./components/KanbanView/KanbanView";
import InventoryView from "./components/InventoryView/InventoryView";

const TABS = { PIPELINE: 0, INVENTORY: 1 };

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS.PIPELINE);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [fragranceModalOpen, setFragranceModalOpen] = useState(false);
  const [boardReady, setBoardReady] = useState(false);

  const handleOpenNewOrder = useCallback(() => setOrderModalOpen(true), []);
  const handleOpenAnalytics = useCallback(() => setAnalyticsOpen(true), []);
  const handleOpenAddFragrance = useCallback(() => setFragranceModalOpen(true), []);

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <TabList activeTabId={activeTab} onTabChange={setActiveTab}>
          <Tab tabInnerClassName="app-tab" id={TABS.PIPELINE}>
            Pipeline
          </Tab>
          <Tab tabInnerClassName="app-tab" id={TABS.INVENTORY}>
            Inventory
          </Tab>
        </TabList>
        {activeTab === TABS.PIPELINE && (
          <div className="app-nav-actions">
            <IconButton
              icon={Dashboard}
              size="medium"
              kind="secondary"
              ariaLabel="Open analytics"
              tooltipContent="Analytics"
              onClick={handleOpenAnalytics}
              disabled={!boardReady}
              className="analytics-button"
            />
            <Button
              size="medium"
              kind="primary"
              onClick={handleOpenNewOrder}
              disabled={!boardReady}
            >
              + New order
            </Button>
          </div>
        )}
        {activeTab === TABS.INVENTORY && (
          <div className="app-nav-actions">
            <Button
              size="medium"
              kind="primary"
              onClick={handleOpenAddFragrance}
            >
              + Add fragrance
            </Button>
          </div>
        )}
      </nav>
      <main className="app-main">
        {activeTab === TABS.PIPELINE && (
          <KanbanView
            orderModalOpen={orderModalOpen}
            setOrderModalOpen={setOrderModalOpen}
            analyticsOpen={analyticsOpen}
            setAnalyticsOpen={setAnalyticsOpen}
            onBoardReady={setBoardReady}
          />
        )}
        {activeTab === TABS.INVENTORY && (
          <InventoryView
            modalOpen={fragranceModalOpen}
            setModalOpen={setFragranceModalOpen}
          />
        )}
      </main>
    </div>
  );
}
