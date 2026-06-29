import { Item, RecipeIngredient } from '../types';

export class Inventory {
  items: Item[] = [];
  materials: Map<string, number> = new Map();

  addItem(item: Item): void {
    this.items.push(item);
  }

  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  addMaterial(id: string, quantity: number): void {
    this.materials.set(id, (this.materials.get(id) ?? 0) + quantity);
  }

  removeMaterial(id: string, quantity: number): boolean {
    const current = this.materials.get(id) ?? 0;
    if (current < quantity) return false;
    const remaining = current - quantity;
    if (remaining === 0) this.materials.delete(id);
    else this.materials.set(id, remaining);
    return true;
  }

  getMaterialCount(id: string): number {
    return this.materials.get(id) ?? 0;
  }

  hasMaterials(ingredients: RecipeIngredient[]): boolean {
    return ingredients.every(
      ing => this.getMaterialCount(ing.materialId) >= ing.quantity
    );
  }
}
