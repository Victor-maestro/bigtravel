import Observable from '../framework/observable.js';


export default class DestinationsModel extends Observable {
  #pointsApiService = null;
  #destinations = [];

  constructor(pointsApiService) {
    super();
    this.#pointsApiService = pointsApiService;
  }

  get = async () => {
    this.#destinations = await this.#pointsApiService.destinations;
    return this.#destinations;
  };

  init = async () => {
    try {
      const destinations = await this.#pointsApiService.destinations;
      this.#destinations = destinations;
    } catch(error) {
      this.#destinations = [];
      throw error;
    }
  };
}
