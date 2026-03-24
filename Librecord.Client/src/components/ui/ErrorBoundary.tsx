import { Component, type ReactNode } from "react";

interface Props {
    children: ReactNode;
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

    render() {
        if (!this.state.hasError) return this.props.children;

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
