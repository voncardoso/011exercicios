import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if(!customerExists) {
      throw new AppError('cold not find any customer with the given id');
    }

    const existentproducts = await this.productsRepository.findAllById(
      products,
    );

    if(!existentproducts.length){
      throw new AppError('cold not find any customer with the given ids');
    }

    const existentProductsIds = existentproducts.map(product => product.id);

    const checkInexistentproducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if(checkInexistentproducts.length){
      throw new AppError(`cold not find product ${checkInexistentproducts[0].id}`);
    }

    const findProductsWithQuantityAvailable = products.filter(
      product => existentproducts.filter(p => p.id == product.id)[0].quantity < product.quantity,
    );

    if(findProductsWithQuantityAvailable.length){
      throw new AppError(`A quantyti ${findProductsWithQuantityAvailable[0].quantity} is not available ${findProductsWithQuantityAvailable[0].id}`);
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentproducts.filter(p => p.id == product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const { order_products} = order;

    const orderedproductsquantity = order_products.map(product => ({
      id: product.product_id,
      quantity: existentproducts.filter(p => p.id == product.product_id)[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedproductsquantity);

    return order;
  }
}

export default CreateOrderService;
