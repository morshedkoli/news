import React from 'react';
import { AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';

interface QualityMetrics {
    avgQualityScore: number;
    qualityDistribution: {
        high: number;
        medium: number;
        low: number;
    };
    topIssues: { issue: string; count: number }[];
    totalDropped: number;
    totalQueued: number;
    totalPublished: number;
}

interface QualityDashboardProps {
    metrics: QualityMetrics;
}

function Progress({ value }: { value: number }) {
    return (
        <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
        </div>
    );
}

export function QualityDashboard({ metrics }: QualityDashboardProps) {
    const total = metrics.totalPublished + metrics.totalQueued + metrics.totalDropped;
    
    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-600">Published</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{metrics.totalPublished}</div>
                    <div className="text-xs text-gray-400">
                        {total > 0 ? Math.round((metrics.totalPublished / total) * 100) : 0}% success rate
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-gray-600">Queued</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{metrics.totalQueued}</div>
                    <div className="text-xs text-gray-400">
                        {total > 0 ? Math.round((metrics.totalQueued / total) * 100) : 0}% pending
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-orange-600" />
                        <span className="text-sm text-gray-600">Dropped</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{metrics.totalDropped}</div>
                    <div className="text-xs text-gray-400">
                        {total > 0 ? Math.round((metrics.totalDropped / total) * 100) : 0}% filtered
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            metrics.avgQualityScore >= 80 ? 'bg-green-100 text-green-700' :
                            metrics.avgQualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            Q
                        </div>
                        <span className="text-sm text-gray-600">Avg Quality</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">{metrics.avgQualityScore}</div>
                    <div className="text-xs text-gray-400">
                        {metrics.avgQualityScore >= 80 ? 'Excellent' :
                         metrics.avgQualityScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </div>
                </div>
            </div>

            {/* Quality Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-semibold text-gray-900">Quality Distribution</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-green-700">High Quality (80-100)</span>
                                <span className="text-sm text-gray-600">{metrics.qualityDistribution.high}</span>
                            </div>
                            <Progress value={total > 0 ? (metrics.qualityDistribution.high / total) * 100 : 0} />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-yellow-700">Medium Quality (60-79)</span>
                                <span className="text-sm text-gray-600">{metrics.qualityDistribution.medium}</span>
                            </div>
                            <Progress value={total > 0 ? (metrics.qualityDistribution.medium / total) * 100 : 0} />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-red-700">Low Quality (0-59)</span>
                                <span className="text-sm text-gray-600">{metrics.qualityDistribution.low}</span>
                            </div>
                            <Progress value={total > 0 ? (metrics.qualityDistribution.low / total) * 100 : 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        <h3 className="font-semibold text-gray-900">Top Quality Issues</h3>
                    </div>
                    <div className="p-6">
                        {metrics.topIssues.length > 0 ? (
                            <div className="space-y-3">
                                {metrics.topIssues.slice(0, 5).map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                        <span className="text-sm font-medium text-gray-700">{item.issue}</span>
                                        <span className="text-sm font-bold text-orange-600">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No quality issues recorded today
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
