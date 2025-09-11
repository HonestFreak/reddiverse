export type InputState = {
  forward: boolean;
  backward: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  sprint: boolean;
  jumpPressed: boolean;
};

export class InputManager {
  state: InputState = {
    forward: false,
    backward: false,
    rotateLeft: false,
    rotateRight: false,
    sprint: false,
    jumpPressed: false,
  };

  private onKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.state.forward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.state.backward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.state.rotateLeft = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.rotateRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = true;
        break;
      case 'Space':
        this.state.jumpPressed = true;
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.state.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.state.backward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.state.rotateLeft = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.state.rotateRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.state.sprint = false;
        break;
    }
  };

  attach(target: Document = document): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  detach(target: Document = document): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
  }

  consumeJump(): boolean {
    if (this.state.jumpPressed) {
      this.state.jumpPressed = false;
      return true;
    }
    return false;
  }
}


