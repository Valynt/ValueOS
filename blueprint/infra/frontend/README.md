# Frontend Application

The frontend exposes a web UI for the Value Operating System. It includes a React Flow diagram to visualize agent relationships and dashboards for each agent’s metrics.

This skeleton uses [Create React App](https://create-react-app.dev/) with Tailwind and React Flow installed. To keep this blueprint concise, only the main components and configuration files are included.

## Project Structure

- `package.json` – Node dependencies including React, Tailwind, and React Flow.
- `src/App.js` – Entry point rendering the value flow visualization.
- `src/components/ValueFlowGraph.jsx` – Visualizes the agent network (imported from the blueprint’s React Flow).

## Running Locally

```bash
npm install
npm start
```

The app runs at `http://localhost:3000`.