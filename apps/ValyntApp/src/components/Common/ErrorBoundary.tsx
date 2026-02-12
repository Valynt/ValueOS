import React from "react";
interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; }
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  render() { return this.state.hasError ? (this.props.fallback ?? <div>Something went wrong</div>) : this.props.children; }
}
export default ErrorBoundary;
