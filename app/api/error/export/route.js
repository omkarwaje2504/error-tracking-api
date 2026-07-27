import ExcelJS from "exceljs";
import clientPromise from "@/lib/mongodb";

/* ───────────────────── Route Config (Next.js 15+) ───────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────── CORS ───────────────────── */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

/* ───────────────────── Helpers ───────────────────── */

function flattenMappedStack(mappedStack) {
    if (!Array.isArray(mappedStack)) return "";
    return mappedStack
        .filter((f) => !f.separator)
        .map((f) => `${f.function || "<anonymous>"} @ ${f.source}:${f.line}:${f.column}`)
        .join("\n");
}

function safe(val) {
    if (val == null) return "";
    if (typeof val === "object") {
        try {
            return JSON.stringify(val);
        } catch {
            return String(val);
        }
    }
    return val;
}

/* ───────────────────── GET (download .xlsx) ───────────────────── */

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");


        const from = searchParams.get("from");
        const query = {};
        if (projectId) query.projectId = projectId;
        if (from) {
            const d = new Date(from);
            if (!isNaN(d)) query.timestamp = { $gte: d };
        }



        const client = await clientPromise;
        const collection = client.db("errors").collection("pixpro");



        // Screenshots excluded — keeps the export light
        const errors = await collection
            .find(query)
            .sort({ timestamp: -1 })
            .project({ screenshot: 0 })
            .toArray();

        /* ── Build workbook ── */
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "pixpro-error-tracker";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet("Errors", {
            views: [{ state: "frozen", ySplit: 1 }],
        });

        sheet.columns = [
            { header: "ID", key: "id", width: 26 },
            { header: "Project ID", key: "projectId", width: 18 },
            { header: "Error Name", key: "name", width: 18 },
            { header: "Message", key: "message", width: 45 },
            { header: "Timestamp", key: "timestamp", width: 22 },
            { header: "City", key: "city", width: 16 },
            { header: "State", key: "state", width: 16 },
            { header: "Country", key: "country", width: 16 },
            { header: "Lat", key: "lat", width: 12 },
            { header: "Lon", key: "lon", width: 12 },
            { header: "Device Info", key: "deviceInfo", width: 30 },
            { header: "Location Info", key: "locationInfo", width: 30 },
            { header: "Mapped Stack", key: "mappedStack", width: 60 },
            { header: "Raw Stack", key: "rawStack", width: 60 },
        ];

        // Header styling
        const headerRow = sheet.getRow(1);
        headerRow.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1F2937" },
        };
        headerRow.alignment = { vertical: "middle" };

        for (const doc of errors) {
            sheet.addRow({
                id: doc._id?.toString() ?? "",
                projectId: doc.projectId ?? "",
                name: doc.error?.name ?? "",
                message: doc.error?.message ?? "",
                timestamp: doc.timestamp ? new Date(doc.timestamp) : "",
                city: doc.city ?? "",
                state: doc.state ?? "",
                country: doc.country ?? "",
                lat: doc.geo?.lat ?? "",
                lon: doc.geo?.lon ?? "",
                deviceInfo: safe(doc.deviceInfo),
                locationInfo: safe(doc.locationInfo),
                mappedStack: flattenMappedStack(doc.mappedStack),
                rawStack: doc.error?.stack ?? "",
            });
        }

        // Body font + wrapping for long cells
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            row.font = { name: "Arial" };
            row.alignment = { vertical: "top", wrapText: true };
        });

        // Date format
        sheet.getColumn("timestamp").numFmt = "yyyy-mm-dd hh:mm:ss";

        const buffer = await workbook.xlsx.writeBuffer();

        const stamp = new Date().toISOString().slice(0, 10);
        const filename = projectId
            ? `pixpro-errors-${projectId}-${stamp}.xlsx`
            : `pixpro-errors-${stamp}.xlsx`;

        return new Response(buffer, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (err) {
        console.error("[pixpro] Export failed", err);
        return Response.json(
            {
                success: false,
                message: "Failed to export errors.",
                error: process.env.NODE_ENV === "development" ? String(err) : undefined,
            },
            { status: 500, headers: corsHeaders },
        );
    }
}