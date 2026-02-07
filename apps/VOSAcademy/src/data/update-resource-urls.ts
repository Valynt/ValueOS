import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { resources } from "../drizzle/schema";

const resourceUpdates = [
  { title: "Value Stream Mapping Template", fileUrl: "/resources/value-stream-mapping-template.md" },
  { title: "Discovery Question Framework", fileUrl: "/resources/discovery-question-framework.md" },
  { title: "Business Case Template", fileUrl: "/resources/business-case-template.md" },
  { title: "ROI Calculator", fileUrl: "/resources/roi-calculator.md" },
  { title: "Value Realization Playbook", fileUrl: "/resources/value-realization-playbook.md" },
  { title: "Customer Success Metrics Guide", fileUrl: "/resources/customer-success-metrics-guide.md" },
  { title: "Value Messaging Framework", fileUrl: "/resources/value-messaging-framework.md" },
  { title: "Objection Handling Guide", fileUrl: "/resources/objection-handling-guide.md" },
  { title: "Executive Presentation Template", fileUrl: "/resources/executive-presentation-template.md" },
  { title: "Competitive Battlecard", fileUrl: "/resources/competitive-battlecard.md" },
  { title: "QBR Expansion Playbook", fileUrl: "/resources/qbr-expansion-playbook.md" },
  { title: "AI Prompt Library", fileUrl: "/resources/ai-prompt-library.md" }
];

async function updateResourceUrls() {
  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available");
    return;
  }

  console.log("🔄 Updating resource URLs...\n");

  for (const update of resourceUpdates) {
    try {
      await db
        .update(resources)
        .set({ fileUrl: update.fileUrl })
        .where(eq(resources.title, update.title));
      
      console.log(`✓ Updated: ${update.title}`);
    } catch (error) {
      console.error(`❌ Failed to update ${update.title}:`, error);
    }
  }

  console.log(`\n✅ Successfully updated ${resourceUpdates.length} resource URLs`);
  console.log("📥 Resources are now downloadable from the Resources page");
}

updateResourceUrls().catch(console.error);
