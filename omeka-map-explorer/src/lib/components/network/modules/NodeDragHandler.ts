/**
 * NodeDragHandler - Handles mouse dragging of nodes in Sigma.js
 * 
 * Based on Sigma.js documentation for mouse interactions and node manipulation.
 * Provides smooth drag interaction while respecting the graph layout.
 */

export interface NodeDragOptions {
  onDragStart?: (nodeId: string) => void;
  onDrag?: (nodeId: string, x: number, y: number) => void;
  onDragEnd?: (nodeId: string) => void;
  dragInertia?: boolean;
  dragPreventLayoutUpdate?: boolean;
}

export class NodeDragHandler {
  private sigma: any;
  private graph: any;
  private isDragging = false;
  private draggedNode: string | null = null;
  private hoveredNode: string | null = null; // Track hovered node
  private dragState = {
    startX: 0,
    startY: 0,
    nodeStartX: 0,
    nodeStartY: 0,
  };
  private options: Required<Omit<NodeDragOptions, 'onDragStart' | 'onDrag' | 'onDragEnd'>> & NodeDragOptions;

  constructor(sigma: any, graph: any, options: NodeDragOptions = {}) {
    this.sigma = sigma;
    this.graph = graph;
    this.options = {
      dragInertia: true,
      dragPreventLayoutUpdate: true,
      ...options,
    };

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.sigma) return;

    // Track which node we're hovering over
    this.sigma.on('enterNode', this.handleEnterNode);
    this.sigma.on('leaveNode', this.handleLeaveNode);

    // Use mousedown with hover detection
    this.sigma.on('mousedown', this.handleMouseDown);
    
    // Global mouse events for dragging
    this.sigma.on('mousemove', this.handleMouseMove);
    this.sigma.on('mouseup', this.handleMouseUp);
    this.sigma.on('mouseout', this.handleMouseUp); // End drag if mouse leaves container
  }

  private handleEnterNode = ({ node }: { node: string }) => {
    this.hoveredNode = node;
  };
  
  private handleLeaveNode = () => {
    this.hoveredNode = null;
  };

  private handleMouseDown = (event: { x: number; y: number; originalEvent?: MouseEvent }) => {
    // Only start dragging if we're hovering over a node
    if (!this.hoveredNode || !this.graph.hasNode(this.hoveredNode)) return;

    // Start dragging
    this.isDragging = true;
    this.draggedNode = this.hoveredNode;
    
    // Store initial positions
    const nodeAttrs = this.graph.getNodeAttributes(this.draggedNode);
    this.dragState = {
      startX: event.x,
      startY: event.y,
      nodeStartX: nodeAttrs.x || 0,
      nodeStartY: nodeAttrs.y || 0,
    };

    // Prevent camera from moving during drag
    this.sigma.getCamera().disable();

    // Call drag start callback
    if (this.options.onDragStart) {
      this.options.onDragStart(this.draggedNode);
    }

    // Prevent default to avoid text selection
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
  };

  private handleMouseMove = (event: { x: number; y: number; originalEvent?: MouseEvent }) => {
    if (!this.isDragging || !this.draggedNode) return;

    const { x, y } = event;
    
    // Calculate movement delta in graph coordinates
    const camera = this.sigma.getCamera();
    const { ratio } = camera.getState();
    
    // Convert screen coordinates to graph coordinates
    const deltaX = (x - this.dragState.startX) * ratio;
    const deltaY = (y - this.dragState.startY) * ratio;
    
    // Calculate new node position
    const newX = this.dragState.nodeStartX + deltaX;
    const newY = this.dragState.nodeStartY + deltaY;

    // Update node position
    this.graph.setNodeAttribute(this.draggedNode, 'x', newX);
    this.graph.setNodeAttribute(this.draggedNode, 'y', newY);

    // Refresh sigma to show the update
    this.sigma.refresh();

    // Call drag callback
    if (this.options.onDrag) {
      this.options.onDrag(this.draggedNode, newX, newY);
    }

    // Prevent default to avoid text selection
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
  };

  private handleMouseUp = () => {
    if (!this.isDragging || !this.draggedNode) return;

    const draggedNodeId = this.draggedNode;

    // End dragging
    this.isDragging = false;
    this.draggedNode = null;

    // Re-enable camera
    this.sigma.getCamera().enable();

    // Call drag end callback
    if (this.options.onDragEnd) {
      this.options.onDragEnd(draggedNodeId);
    }
  };

  /**
   * Check if currently dragging a node
   */
  isDraggingNode(): boolean {
    return this.isDragging;
  }

  /**
   * Get the currently dragged node ID
   */
  getDraggedNode(): string | null {
    return this.draggedNode;
  }

  /**
   * Programmatically start dragging a node
   */
  startDrag(nodeId: string, startX: number, startY: number): boolean {
    if (!this.graph.hasNode(nodeId) || this.isDragging) return false;

    const nodeAttrs = this.graph.getNodeAttributes(nodeId);
    
    this.isDragging = true;
    this.draggedNode = nodeId;
    this.dragState = {
      startX,
      startY,
      nodeStartX: nodeAttrs.x || 0,
      nodeStartY: nodeAttrs.y || 0,
    };

    this.sigma.getCamera().disable();

    if (this.options.onDragStart) {
      this.options.onDragStart(nodeId);
    }

    return true;
  }

  /**
   * Programmatically end dragging
   */
  endDrag(): void {
    this.handleMouseUp();
  }

  /**
   * Update drag options
   */
  updateOptions(newOptions: Partial<NodeDragOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    if (this.sigma) {
      this.sigma.off('enterNode', this.handleEnterNode);
      this.sigma.off('leaveNode', this.handleLeaveNode);
      this.sigma.off('mousedown', this.handleMouseDown);
      this.sigma.off('mousemove', this.handleMouseMove);
      this.sigma.off('mouseup', this.handleMouseUp);
      this.sigma.off('mouseout', this.handleMouseUp);
    }

    // End any active drag
    if (this.isDragging) {
      this.endDrag();
    }
  }
}
