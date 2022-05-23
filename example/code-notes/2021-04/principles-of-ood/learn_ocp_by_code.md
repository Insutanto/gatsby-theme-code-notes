---
title: 实践中学设计：开闭原则的实践
emoji: 👮
tags: 
  - ood
  - java
created: 2021-04-02T20:16:50.000Z
modified: 2021-04-06T23:50:50.000Z
---

## 前言

这可能是系列文章的第一篇（如果没有后续，就是最后一篇哈哈）。主要将平时发现的，一些源码中的坏味道，拿出来讨论，分析和总结。而这次，我们讨论面向对象设计的核心原则——开闭原则。

## 场景

最近工作中开发基于 Spring Boot 的 Java gRPC 服务，用到了 Line 开源的[armeria](https://github.com/line/armeria)框架。同事在 AutoConfigurate 层封装了 ArmeriaServerConfigurator ，可以按照线上的标准，统一对 Server 进行配置，所以我们线上的每个服务都使用了相同的统一配置类。一切都进展的很顺利，直到我需要给我的 rpc service 们增加一个装饰器，对 Server 内所有的 rpc 接口实现一个功能。

起初，我以为只需要实现一个装饰器而已，直到我打开了同事封装的配置类代码，结构类似这样：

```java
@Configuration
public class HelloConfiguration {
    @Bean
    public ArmeriaServerConfigurator armeriaServerConfigurator(HelloAnnotatedService service) {
        return builder -> {
            // Add DocService that enables you to send Thrift and gRPC requests from web browser.
            builder.serviceUnder("/docs", new DocService());

            // Log every message which the server receives and responds.
            builder.decorator(LoggingService.newDecorator());

            // Write access log after completing a request.
            builder.accessLogWriter(AccessLogWriter.combined(), false);

            // Add an Armeria annotated HTTP service.
            builder.annotatedService(service);
        };
    }
}
```

## 分析坏味道

当我看到这段代码，不禁眉头一皱，发现事情不简单。各类配置都耦合在一整个代码块中，如果我想要增加任何原来不支持的配置，就需要在整个配置类的基础上进行修改：
要么让自己的配置成为统一配置的一部分；
要么将整个配置类拷贝出来，独自维护一个版本。

很明显，这违背了“开闭原则”:

> 软件中的对象（类，模块，函数等等）应该对于扩展是开放的，但是对于修改是封闭的。
software entities (classes, modules, functions, etc.) should be open for extension, but closed for modification
——《Object-Oriented Software Construction》

因为不是每个服务所需要的配置，都应该成为统一配置的一部分，也不是每个配置都需要配置给每个服务；所以，在这种代码的组织下，遇到个性化的需求，大家难免需要拷贝配置类，然后增加自己的配置。然而，一旦这么做了，就失去了统一配置类的意义：
人们需要它，正是因为不想在每个地方都增加一份它的拷贝。
毕竟需要统一增加一个新的配置时，在拷贝他的每个地方，都要同步增加新的代码（坏的味道）。

## 解决我们的问题

回到需要解决的问题上，我们需要思考一下，怎么样能够组织代码，在满足需求的同时，实践“开闭原则”。

下面三个原则，是实现开闭原则的具体实现规范（摘自[http://c.biancheng.net/view/8508.html](http://c.biancheng.net/view/8508.html)）：
1. 里氏替换原则：不要破坏继承体系，子类重写方法功能发生改变，不应该影响父类方法的含义。
2. 合成复用原则：尽量使用组合或者聚合关系实现代码复用，少使用继承。
3. 依赖倒置原则：高层不应该依赖低层，要面向接口编程。

一般在面向对象的领域上实践**开闭原则**，我们首先需要考虑，代码使用**继承复用**还是**合成复用**，如果使用**继承复用**，代码主要遵循**里氏替换原则**，如果使用合成复用，代码主要遵循**合成复用原则**，而无论我们选择使用哪种复用，都需要遵循**依赖倒置原则**。

考虑在这个场景上，我们主要的工作是实现新的类（装饰器），而不是在原有父类的基础上进行扩展。如果我们使用**继承复用**，一个服务可能存在多个装饰器，如果每出现一个新的装饰器，就继承复用原有父类，在扩展时，就只能不断耦合之前的类来实现代码复用。这种情况下，使用**继承复用**，会产生大量耦合父类的子类，面对不同的需求，不利于父类代码的扩展，不能灵活的应用在需要组合不同功能领域；另外一方面，**继承复用**也不能在运行时动态进行复用。
于是乎，**合成复用**显得格外有吸引力，一方面，他在保证“黑箱”复用的同时，避免了不同需求下，使用继承产生的耦合；我们不需要知晓统一配置类的实现细节，不需要生成各种装饰器需求的子配置类，也不需要在变更统一**父配置类**时，纠结变更对**子配置类**产生多余的影响。另外一方面，**合成复用**能够让我们在运行时动态进行复用，像需要运行时按照配置来复用代码的特性，就能够很好的实现了，比如，根据生产、开发和测试环境来组合不同装饰器的配置。所以，我们最后考虑使用**合成复用**的方法，来修改我们的代码。

于是，我们按照**合成复用原则**和**依赖倒置原则**来实践。
**遵循合成复用原则：**在统一配置类中，获取装饰器对象，然后将装饰器对象配置到 Server 中，就能实现**合成复用**。
**遵循依赖倒置原则：**实现一个装饰器接口，让统一配置类（底层模块）和装饰器（高层模块）的实现细节，能够依赖这个抽象的装饰器接口。统一配置类通过装饰器接口获取装饰器对象，来复用不同的装饰器。新的装饰器只需要继承装饰器接口，创建装饰器对象，就能满足扩展需求，而不需要修改统一配置类。我们让装饰器（高层模块）不依赖统一配置类（底层模块），最终实现**依赖倒置**。
总结下来，我们要做的就是：统一配置类中，获取装饰器接口类型的对象，然后配置到 Server 中；装饰器类，不同的装饰器都需要继承接口类型；最后在需要的时候，为统一配置类实例化装饰器对象。

我们结合Spring Boot的特征，可以这样实践：
1. 创建一个自定义装饰器的接口类；
2. 让我们自定义的装饰器去继承接口类；
3. 在 Spring Boot 中将装饰器创建成 Bean ；
4. 在自动装配的时候，配置自定义装饰器接口类型的 Bean 。
最后，我们的统一配置类（底层模块）和扩展的装饰器类（高层模块），就能满足**开闭原则**了。

具体的实现可以参考代码： 

```java
// 自定义装饰器接口
public interface ICustomDecoratingHttpServiceFunction extends DecoratingHttpServiceFunction {
}
```

```java
// 自定义装饰器
public class HelloDecoratingFunction implements ICustomDecoratingHttpServiceFunction {
    @Override
    public HttpResponse serve(HttpService delegate, ServiceRequestContext ctx, HttpRequest req) throws Exception {
        System.out.println("HelloDecoratingFunction");
        return delegate.serve(ctx, req);
    }
}
```

```java
// 通过 Configuration 创建装饰器的 Bean
@Configuration
public class HelloDecoratingConfiguration {

    @Bean(value = "helloDecoratingFunction")
    public ICustomDecoratingHttpServiceFunction getHelloDecoratingFunction() {
        return new HelloDecoratingFunction();
    }

}
```

```java
// 获取接口类型的 Bean，然后将他们配置上
@Configuration
public class HelloConfiguration {

    @Autowired
    private ApplicationContext ctx;

    /**
     * A user can configure a {@link Server} by providing an {@link ArmeriaServerConfigurator} bean.
     */
    @Bean
    public ArmeriaServerConfigurator armeriaServerConfigurator(HelloAnnotatedService service) {
        // Customize the server using the given ServerBuilder. For example:
        return builder -> {
            // Add DocService that enables you to send Thrift and gRPC requests from web browser.
            builder.serviceUnder("/docs", new DocService());

            // Log every message which the server receives and responds.
            builder.decorator(LoggingService.newDecorator());

						String[] names = ctx.getBeanNamesForType(ICustomDecoratingHttpServiceFunction.class);
            Arrays.stream(names).forEach(name -> builder.decorator(ctx.getBean(name, ICustomDecoratingHttpServiceFunction.class)));

            // Write access log after completing a request.
            builder.accessLogWriter(AccessLogWriter.combined(), false);

            // Add an Armeria annotated HTTP service.
            builder.annotatedService(service);
        };
    }
}
```

## 总结

以上就是我们从实际问题出发，实践面向对象的设计原则的过程。抛开细节，我们通过下面的方法，实践了**开闭原则**：
高层模块：
1. 让高层模块去继承自定义的接口类；
2. 在Spring Boot中将高层模块创建成Bean。
底层模块：
1. 创建一个自定义的接口类；
2. 通过获取自定义接口类型的 Bean 对象，完成底层模块对高层模块的代码复用。

我们还讨论了实践**开闭原则**的其他三个原则，**合成复用原则**，**里氏替换原则**和**依赖反转原则**。要在面向对象的代码复用中实践开闭原则，我们首先就要从**合成复用**和**继承复用**中做选择，以此确定遵循**合成复用原则**（使用组合或者聚合关系实现代码复用）还是**里氏替换原则**（不破坏继承体系，重写不影响父类方法含义）；与此同时，我们需要践行**依赖反转原则，**通过面向接口，然细节依赖抽象，让高层模块不依赖底层模块。

至此，我们从**开闭原则**，一路讨论了**合成复用原则**，**里氏替换原则**和**依赖反转原则**，如果有机会，后面会写更多设计相关的文章。