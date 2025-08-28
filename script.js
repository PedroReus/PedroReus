document.addEventListener('DOMContentLoaded', () => {
    const textareas = {
        '1': document.getElementById('text1'),
        '2': document.getElementById('text2'),
        '3': document.getElementById('text3')
    };

    const fileInputs = {
        '1': document.getElementById('file1'),
        '2': document.getElementById('file2'),
        '3': document.getElementById('file3')
    };

    const comparisonSelect = document.getElementById('comparison');
    const compareBtn = document.getElementById('compare-btn');
    const downloadBtn = document.getElementById('download-btn');
    const summaryEl = document.getElementById('summary');
    const diffOutputEl = document.getElementById('diff-output');

    for (const key in fileInputs) {
        fileInputs[key].addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    textareas[key].value = e.target.result;
                };
                reader.readAsText(file);
            }
        });
    }

    compareBtn.addEventListener('click', () => {
        const selection = comparisonSelect.value;
        const [index1, index2] = selection.split('v');
        const text1 = textareas[index1].value;
        const text2 = textareas[index2].value;

        const diff = Diff.diffLines(text1, text2);

        diffOutputEl.innerHTML = '';

        const col1 = document.createElement('div');
        col1.className = 'diff-col';
        col1.innerHTML = `<h3>Texto ${index1} (Original)</h3>`;

        const col2 = document.createElement('div');
        col2.className = 'diff-col';
        col2.innerHTML = `<h3>Texto ${index2} (Nuevo)</h3>`;

        const col3 = document.createElement('div');
        col3.className = 'diff-col';
        col3.innerHTML = '<h3>Análisis</h3>';

        diffOutputEl.appendChild(col1);
        diffOutputEl.appendChild(col2);
        diffOutputEl.appendChild(col3);

        let addedCount = 0;
        let removedCount = 0;

        diff.forEach(part => {
            const cell1 = document.createElement('div');
            const cell2 = document.createElement('div');
            const analysisCell = document.createElement('div');
            analysisCell.className = 'analysis-cell';

            if (part.added) {
                cell2.className = 'diff-added';
                cell2.textContent = part.value;
                analysisCell.textContent = 'Añadido';
                addedCount += part.count;
            } else if (part.removed) {
                cell1.className = 'diff-removed';
                cell1.textContent = part.value;
                analysisCell.textContent = 'Eliminado';
                removedCount += part.count;
            } else {
                cell1.textContent = part.value;
                cell2.textContent = part.value;
            }

            col1.appendChild(cell1);
            col2.appendChild(cell2);
            col3.appendChild(analysisCell);
        });

        summaryEl.textContent = `Resumen: ${addedCount} adiciones, ${removedCount} eliminaciones.`;
        downloadBtn.disabled = !(text1.length > 0 || text2.length > 0);
    });

    downloadBtn.addEventListener('click', () => {
        const selection = comparisonSelect.value;
        const [index1, index2] = selection.split('v');

        const reportContent = `
            <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe de Comparación</title>
            <style>
                body { font-family: sans-serif; } table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; white-space: pre-wrap; }
                th { background-color: #f2f2f2; } .diff-added { background-color: #ddffdd; }
                .diff-removed { background-color: #ffdddd; text-decoration: line-through; }
                .analysis-cell { font-style: italic; color: #555; }
            </style></head><body>
            <h1>Informe de Comparación</h1><h2>Comparando Texto ${index1} y Texto ${index2}</h2>
            <h3>${summaryEl.textContent}</h3>
            <table>
                <thead><tr><th>Texto ${index1} (Original)</th><th>Texto ${index2} (Nuevo)</th><th>Análisis</th></tr></thead>
                <tbody>${generateReportTableBody()}</tbody>
            </table></body></html>`;

        const blob = new Blob([reportContent], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `informe_comparacion_${selection}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    function generateReportTableBody() {
        let tableBody = '';
        const col1Rows = diffOutputEl.querySelector('.diff-col:nth-child(1)').children;
        const col2Rows = diffOutputEl.querySelector('.diff-col:nth-child(2)').children;
        const col3Rows = diffOutputEl.querySelector('.diff-col:nth-child(3)').children;

        for (let i = 1; i < col1Rows.length; i++) {
            const text1 = col1Rows[i].outerHTML;
            const text2 = col2Rows[i].outerHTML;
            const analysis = col3Rows[i].textContent;
            tableBody += `<tr><td>${text1}</td><td>${text2}</td><td class="analysis-cell">${analysis}</td></tr>`;
        }
        return tableBody;
    }
});
