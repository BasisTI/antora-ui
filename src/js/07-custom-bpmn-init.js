function setupDocumentationDisplay (viewer, containerId) {
  const eventBus = viewer.get('eventBus')
  const overlays = viewer.get('overlays')
  let currentOverlayId = null
  const diagramContainer = document.getElementById(containerId)

  eventBus.on('element.click', function (event) {
    const element = event.element
    const businessObject = element.businessObject

    if (currentOverlayId) {
      try {
        overlays.remove(currentOverlayId)
      } catch (e) { /* ignore */
      }
      currentOverlayId = null
    }

    if (businessObject && businessObject.documentation && businessObject.documentation.length > 0) {
      const docHtml = businessObject.documentation.text
      if (docHtml && docHtml.trim() !== '') {
        currentOverlayId = overlays.add(element.id, 'documentation', {
          position: { bottom: 15, left: 0 }, // Adjust as needed
          html: `<div class="bpmn-documentation-overlay">${docHtml}</div>`,
          show: { minZoom: 0.4 },
        })
      }
    }
  })

  // Optional: Close overlay when clicking outside an element
  diagramContainer.addEventListener('click', function (event) {
    if (event.target === diagramContainer && currentOverlayId) {
      try {
        overlays.remove(currentOverlayId)
      } catch (e) { /* ignore */
      }
      currentOverlayId = null
    }
  })
}

async function initializeBpmnViewer (containerId, diagramPath) {
  const viewer = new window.BpmnJS({ container: `#${containerId}` })
  const containerElement = document.getElementById(containerId)
  try {
    const response = await window.fetch(diagramPath)
    if (!response.ok) {
      throw new Error(`Erro ao carregar o XML do BPMN (${response.status}): ${diagramPath}`)
    }
    const bpmnXML = await response.text()
    await viewer.importXML(bpmnXML)
    viewer.get('canvas').zoom('fit-viewport')
    setupDocumentationDisplay(viewer, containerId)
  } catch (err) {
    console.error('Erro na exibição do diagrama BPMN:', diagramPath, err)
    if (containerElement) {
      containerElement.innerHTML = `<p style="color:red;">Erro ao carregar o diagrama: ${err.message}</p>`
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const bpmnContainers = document.querySelectorAll('.bpmn-diagram-container')
  bpmnContainers.forEach(async (container) => {
    const diagramPath = container.dataset.bpmnXmlPath
    const containerId = container.id
    if (diagramPath && containerId && !diagramPath.startsWith('ERROR_RESOLVING_')) {
      await initializeBpmnViewer(containerId, diagramPath)
    } else if (diagramPath && diagramPath.startsWith('ERROR_RESOLVING_')) {
      container.innerHTML = '<p style="color:red;">Erro: Não foi possível resolver o caminho para o diagrama BPMN: ' +
        `${diagramPath.substring('ERROR_RESOLVING_'.length)}</p>`
    }
  })
})
