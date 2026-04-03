import { Component, type ReactNode } from "react";
import { logger } from "@librecord/domain";

interface Props {
    children: ReactNode;
    /** "page" shows full-screen error. "section" shows inline error in the affected panel. */
    variant?: "page" | "section";
    /** Label for logging (e.g. "ChannelSidebar", "Outlet") */
    label?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.ui.error(`ErrorBoundary [${this.props.label ?? "unknown"}] caught`, error, info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        if (this.props.variant === "section") {
            return (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <p className="text-sm text-[#949ba4] mb-3">Something went wrong</p>
                    {this.state.error && (
                        <pre className="text-[10px] text-[#72767d] bg-[#1e1f22] rounded p-2 mb-3 max-w-full overflow-auto max-h-20">
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="px-3 py-1.5 bg-[#5865F2] text-white text-xs rounded font-medium hover:bg-[#4752c4]"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#313338] text-gray-200">
                <div className="text-center max-w-md px-6">
                    <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
                    <p className="text-sm text-[#949ba4] mb-6">
                        An unexpected error occurred. Try refreshing the page.
                    </p>
                    {this.state.error && (
                        <pre className="text-xs text-[#949ba4] bg-[#1e1f22] rounded-lg p-4 mb-6 text-left overflow-auto max-h-32">
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-[#5865F2] text-white rounded font-medium hover:bg-[#4752c4] transition-colors"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }
}
