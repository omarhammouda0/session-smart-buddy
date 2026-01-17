// Error Boundary Component
// Catches JavaScript errors and prevents app crashes

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private copyError = () => {
    const errorText = `Error: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}\n\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorText).catch(console.error);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || "Unknown error";
      const errorStack = this.state.error?.stack || "";

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl">حدث خطأ غير متوقع</CardTitle>
              <CardDescription>
                نعتذر عن هذا الخطأ. يرجى تحديث الصفحة للمتابعة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Always show error details for debugging */}
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 font-mono overflow-auto max-h-40 space-y-2">
                <p className="font-bold">Error:</p>
                <p className="break-all">{errorMessage}</p>
                {errorStack && (
                  <>
                    <p className="font-bold mt-2">Location:</p>
                    <p className="break-all text-[10px]">{errorStack.split('\n').slice(0, 3).join('\n')}</p>
                  </>
                )}
              </div>

              <Button onClick={this.copyError} variant="ghost" size="sm" className="w-full text-xs">
                <Copy className="h-3 w-3 ml-1" />
                نسخ تفاصيل الخطأ
              </Button>

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="outline" className="flex-1">
                  محاولة مرة أخرى
                </Button>
                <Button onClick={this.handleReload} className="flex-1">
                  <RefreshCw className="h-4 w-4 ml-2" />
                  تحديث الصفحة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
