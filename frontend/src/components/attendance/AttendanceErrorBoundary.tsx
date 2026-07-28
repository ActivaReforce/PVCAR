import React, { Component, ReactNode } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class AttendanceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Error logging could go here, but we're not adding logs per requirements
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-4 lg:p-6">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="rounded-full bg-warning/20 p-3">
                  <AlertTriangle className="h-8 w-8 text-warning" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    La asistencia se está cargando o reintentando
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Si el problema persiste, intenta nuevamente.
                  </p>
                </div>

                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reintentar
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

export default AttendanceErrorBoundary;
