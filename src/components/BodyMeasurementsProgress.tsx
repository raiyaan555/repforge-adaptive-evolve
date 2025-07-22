import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Measurement {
  id: string;
  measurement_date: string;
  measurement_type: string;
  body_weight?: number;
  chest?: number;
  arms?: number;
  back?: number;
  waist?: number;
  thighs?: number;
  calves?: number;
  shoulders?: number;
  weight_unit: string;
  measurement_unit: string;
}

interface ProgressData {
  field: string;
  label: string;
  pre: number;
  post: number;
  change: number;
  unit: string;
  changePercent: number;
}

export function BodyMeasurementsProgress() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadMeasurements();
    }
  }, [user]);

  const loadMeasurements = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMeasurements(data || []);
      processProgressData(data || []);
      prepareChartData(data || []);
    } catch (error) {
      console.error('Error loading measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const processProgressData = (data: Measurement[]) => {
    const preMeasurements = data.filter(m => m.measurement_type === 'pre_mesocycle');
    const postMeasurements = data.filter(m => m.measurement_type === 'post_mesocycle');

    if (preMeasurements.length === 0 || postMeasurements.length === 0) {
      setProgressData([]);
      return;
    }

    const latestPre = preMeasurements[preMeasurements.length - 1];
    const latestPost = postMeasurements[postMeasurements.length - 1];

    const fields = [
      { key: 'body_weight', label: 'Body Weight', unit: latestPre.weight_unit },
      { key: 'chest', label: 'Chest', unit: latestPre.measurement_unit },
      { key: 'arms', label: 'Arms', unit: latestPre.measurement_unit },
      { key: 'back', label: 'Back', unit: latestPre.measurement_unit },
      { key: 'waist', label: 'Waist', unit: latestPre.measurement_unit },
      { key: 'thighs', label: 'Thighs', unit: latestPre.measurement_unit },
      { key: 'calves', label: 'Calves', unit: latestPre.measurement_unit },
      { key: 'shoulders', label: 'Shoulders', unit: latestPre.measurement_unit }
    ];

    const progress: ProgressData[] = [];

    fields.forEach(field => {
      const preValue = latestPre[field.key as keyof Measurement] as number;
      const postValue = latestPost[field.key as keyof Measurement] as number;

      if (preValue && postValue) {
        const change = postValue - preValue;
        const changePercent = (change / preValue) * 100;
        
        progress.push({
          field: field.key,
          label: field.label,
          pre: preValue,
          post: postValue,
          change,
          unit: field.unit,
          changePercent
        });
      }
    });

    setProgressData(progress);
  };

  const prepareChartData = (data: Measurement[]) => {
    // Group by measurement date and create chart data
    const chartPoints: { [key: string]: any } = {};

    data.forEach(measurement => {
      const date = measurement.measurement_date;
      if (!chartPoints[date]) {
        chartPoints[date] = { date };
      }

      // Only include fields that have values
      const fields = ['body_weight', 'chest', 'arms', 'back', 'waist', 'thighs', 'calves', 'shoulders'];
      fields.forEach(field => {
        const value = measurement[field as keyof Measurement] as number;
        if (value) {
          chartPoints[date][field] = value;
        }
      });
    });

    const sortedData = Object.values(chartPoints).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    setChartData(sortedData);
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatChange = (change: number, unit: string) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)} ${unit}`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-sm text-muted-foreground">Loading measurements...</p>
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-2">No measurements recorded yet</p>
        <p className="text-sm text-muted-foreground">
          Start a mesocycle to begin tracking your body measurements
        </p>
      </div>
    );
  }

  if (progressData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-2">No progress comparison available</p>
        <p className="text-sm text-muted-foreground">
          Complete a full mesocycle to see before/after comparisons
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {progressData.map((item) => (
          <Card key={item.field} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{item.label}</h4>
              {getTrendIcon(item.change)}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Before:</span>
                <span>{item.pre.toFixed(1)} {item.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">After:</span>
                <span>{item.post.toFixed(1)} {item.unit}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-muted-foreground">Change:</span>
                <span className={item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                  {formatChange(item.change, item.unit)}
                </span>
              </div>
              {Math.abs(item.changePercent) > 0.1 && (
                <Badge variant={item.change > 0 ? 'default' : 'secondary'} className="text-xs">
                  {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                </Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Progress Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  {progressData.map((item, index) => (
                    <Line
                      key={item.field}
                      type="monotone"
                      dataKey={item.field}
                      stroke={`hsl(${(index * 45) % 360}, 70%, 50%)`}
                      strokeWidth={2}
                      name={item.label}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}